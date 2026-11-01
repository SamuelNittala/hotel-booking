import { describe, expect, it } from 'vitest';
import { Booking } from '../../../src/booking/booking';
import { InvalidRefundPolicyError } from '../../../src/cancellation/errors';
import { FullRefundPolicy } from '../../../src/cancellation/policy/full-refund-policy';
import { NoRefundPolicy } from '../../../src/cancellation/policy/no-refund-policy';
import { TimeBasedRefundPolicy } from '../../../src/cancellation/policy/time-based-refund-policy';
import { CancellationContext } from '../../../src/cancellation/refund-policy';
import { DateRange } from '../../../src/shared/date-range';

const checkIn = '2026-11-10';

const context = (cancelledAt: string, paidAmount = 8000): CancellationContext => ({
  booking: Booking.create({
    id: 1,
    guestId: 50,
    propertyId: 1,
    roomId: 101,
    guestCount: 2,
    dateRange: DateRange.of(checkIn, '2026-11-12'),
    totalAmount: paidAmount,
    createdAt: new Date('2026-10-01T00:00:00Z'),
  }),
  paidAmount,
  cancelledAt: new Date(cancelledAt),
});

describe('FullRefundPolicy', () => {
  it('pays back everything, even on the day of check-in', () => {
    expect(new FullRefundPolicy().refundFor(context('2026-11-10T09:00:00Z'))).toBe(8000);
  });
});

describe('NoRefundPolicy', () => {
  it('pays back nothing, even long before check-in', () => {
    expect(new NoRefundPolicy().refundFor()).toBe(0);
  });
});

describe('TimeBasedRefundPolicy.standard', () => {
  const policy = TimeBasedRefundPolicy.standard();

  it.each([
    ['30 days before', '2026-10-11T12:00:00Z', 8000],
    ['exactly 7 days before', '2026-11-03T12:00:00Z', 8000],
    ['6 days before', '2026-11-04T12:00:00Z', 4000],
    ['3 days before', '2026-11-07T12:00:00Z', 4000],
    ['exactly 2 days before', '2026-11-08T12:00:00Z', 4000],
    ['1 day before', '2026-11-09T12:00:00Z', 0],
    ['the day of check-in', '2026-11-10T00:00:00Z', 0],
    ['after check-in', '2026-11-11T12:00:00Z', 0],
  ])('refunds %s: %s', (_label, cancelledAt, expected) => {
    expect(policy.refundFor(context(cancelledAt))).toBe(expected);
  });

  it('counts calendar days, ignoring the time of day', () => {
    expect(policy.refundFor(context('2026-11-03T00:00:00Z'))).toBe(8000);
    expect(policy.refundFor(context('2026-11-03T23:59:59Z'))).toBe(8000);
    expect(policy.refundFor(context('2026-11-04T00:00:00Z'))).toBe(4000);
  });

  it('never refunds more than was paid', () => {
    expect(policy.refundFor(context('2026-10-01T00:00:00Z', 1234.56))).toBe(1234.56);
  });
});

describe('TimeBasedRefundPolicy with custom tiers', () => {
  it('uses the tiers it was given, whatever order they are listed in', () => {
    const policy = new TimeBasedRefundPolicy([
      { minDaysBeforeCheckIn: 1, refundPercent: 20 },
      { minDaysBeforeCheckIn: 14, refundPercent: 100 },
      { minDaysBeforeCheckIn: 5, refundPercent: 60 },
    ]);

    expect(policy.refundFor(context('2026-10-20T00:00:00Z'))).toBe(8000); // 21 days
    expect(policy.refundFor(context('2026-11-01T00:00:00Z'))).toBe(4800); // 9 days
    expect(policy.refundFor(context('2026-11-09T00:00:00Z'))).toBe(1600); // 1 day
    expect(policy.refundFor(context('2026-11-10T00:00:00Z'))).toBe(0); // 0 days
  });

  it('rounds the refund to the nearest 0.01', () => {
    const policy = new TimeBasedRefundPolicy([{ minDaysBeforeCheckIn: 0, refundPercent: 33 }]);

    expect(policy.refundFor(context('2026-11-01T00:00:00Z', 1001))).toBe(330.33);
  });

  it('pays back nothing when there are no tiers', () => {
    expect(new TimeBasedRefundPolicy([]).refundFor(context('2026-10-01T00:00:00Z'))).toBe(0);
  });

  it('allows a tier with zero percent', () => {
    const policy = new TimeBasedRefundPolicy([{ minDaysBeforeCheckIn: 0, refundPercent: 0 }]);

    expect(policy.refundFor(context('2026-10-01T00:00:00Z'))).toBe(0);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects %s days', (minDaysBeforeCheckIn) => {
    expect(() => new TimeBasedRefundPolicy([{ minDaysBeforeCheckIn, refundPercent: 50 }])).toThrow(
      InvalidRefundPolicyError,
    );
  });

  it.each([-1, 101, Number.NaN])('rejects %s percent', (refundPercent) => {
    expect(() => new TimeBasedRefundPolicy([{ minDaysBeforeCheckIn: 3, refundPercent }])).toThrow(
      InvalidRefundPolicyError,
    );
  });

  it('rejects two tiers that start at the same number of days', () => {
    expect(
      () =>
        new TimeBasedRefundPolicy([
          { minDaysBeforeCheckIn: 3, refundPercent: 50 },
          { minDaysBeforeCheckIn: 3, refundPercent: 80 },
        ]),
    ).toThrow(InvalidRefundPolicyError);
  });
});
