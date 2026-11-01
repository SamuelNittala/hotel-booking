import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAvailability } from '../../src/availability/in-memory-availability';
import { BookingService } from '../../src/booking/booking-service';
import { BookingNotFoundError, InvalidBookingTransitionError } from '../../src/booking/errors';
import { InMemoryBookingRepository } from '../../src/booking/in-memory-booking-repository';
import { CancellationService } from '../../src/cancellation/cancellation-service';
import { InvalidRefundAmountError, NoSuccessfulPaymentError } from '../../src/cancellation/errors';
import { FullRefundPolicy } from '../../src/cancellation/policy/full-refund-policy';
import { NoRefundPolicy } from '../../src/cancellation/policy/no-refund-policy';
import { TimeBasedRefundPolicy } from '../../src/cancellation/policy/time-based-refund-policy';
import { CancellationContext, RefundPolicy } from '../../src/cancellation/refund-policy';
import { InMemoryPaymentRepository } from '../../src/payment/in-memory-payment-repository';
import { PaymentMethodRegistry } from '../../src/payment/method/payment-method-registry';
import { UpiPaymentMethod } from '../../src/payment/method/upi-payment-method';
import { PaymentService } from '../../src/payment/payment-service';
import { InMemoryPropertyRepository } from '../../src/property/in-memory-property-repository';
import { Property } from '../../src/property/property';
import { PropertyLocation } from '../../src/property/property-location';
import { Room } from '../../src/property/room';
import { DateRange } from '../../src/shared/date-range';
import { SequentialIdGenerator } from '../../src/shared/sequential-id-generator';
import { TestGateway } from '../support/test-gateway';

const stay = DateRange.of('2026-11-10', '2026-11-12'); // 2 nights at 4000 = 8000
const now = new Date('2026-11-01T10:00:00Z'); // 9 days before check-in
const upi = { upiId: 'asha@okbank' };

const fixedRefund = (amount: number): RefundPolicy => ({ refundFor: () => amount });

describe('CancellationService', () => {
  let gateway: TestGateway;
  let payments: InMemoryPaymentRepository;
  let bookings: InMemoryBookingRepository;
  let availability: InMemoryAvailability;
  let bookingService: BookingService;
  let paymentService: PaymentService;

  beforeEach(async () => {
    gateway = new TestGateway();
    payments = new InMemoryPaymentRepository();
    bookings = new InMemoryBookingRepository();
    availability = new InMemoryAvailability();
    const properties = new InMemoryPropertyRepository();
    await properties.save(
      Property.create({
        id: 1,
        name: 'Lakeview Inn',
        ownerId: 7,
        location: PropertyLocation.of({ city: 'Bengaluru', locality: 'Indiranagar', latitude: 12.97, longitude: 77.64 }),
        amenities: ['wifi'],
        starRating: 4,
        rooms: [Room.create({ id: 101, type: 'queen', capacity: 2, pricePerNight: 4000 })],
      }),
    );
    bookingService = new BookingService(properties, bookings, availability, new SequentialIdGenerator());
    paymentService = new PaymentService(
      payments,
      bookings,
      bookingService,
      new PaymentMethodRegistry([new UpiPaymentMethod(gateway)]),
      new SequentialIdGenerator(),
    );
  });

  const cancellationWith = (policy: RefundPolicy) =>
    new CancellationService(bookings, payments, bookingService, paymentService, policy, () => now);

  const pendingBooking = () =>
    bookingService.book({ guestId: 50, propertyId: 1, roomType: 'queen', guestCount: 2, dateRange: stay });

  const paidBooking = async () => {
    const booking = await pendingBooking();
    const payment = await paymentService.pay({ bookingId: booking.id, method: 'UPI', details: upi });
    return { booking, payment };
  };

  const statusOf = async (bookingId: number) => (await bookings.findById(bookingId))?.status;

  describe('a pending booking', () => {
    it('cancels it and frees the dates, with no refund', async () => {
      const booking = await pendingBooking();

      const result = await cancellationWith(new FullRefundPolicy()).cancel(booking.id);

      expect(result.booking.status).toBe('cancelled');
      expect(result.refundAmount).toBe(0);
      expect(result.refundStatus).toBe('none');
      expect(result.paymentId).toBeUndefined();
      expect(await availability.check(stay, 101)).toBe(true);
      expect(gateway.refunds).toEqual([]);
    });

    it('does not ask the policy', async () => {
      const booking = await pendingBooking();
      const asked: CancellationContext[] = [];

      await cancellationWith({ refundFor: (context) => (asked.push(context), 0) }).cancel(booking.id);

      expect(asked).toEqual([]);
    });
  });

  describe('a paid booking', () => {
    it('cancels it, frees the dates and pays back what the policy says', async () => {
      const { booking, payment } = await paidBooking();

      const result = await cancellationWith(new FullRefundPolicy()).cancel(booking.id);

      expect(result.booking.status).toBe('cancelled');
      expect(result.refundAmount).toBe(8000);
      expect(result.refundStatus).toBe('refunded');
      expect(result.paymentId).toBe(payment.id);
      expect(await availability.check(stay, 101)).toBe(true);
      expect(gateway.refunds).toEqual([{ reference: payment.gatewayReference, amount: 8000 }]);
    });

    it('records a partial refund on the payment', async () => {
      const { booking, payment } = await paidBooking();

      const result = await cancellationWith(fixedRefund(3000)).cancel(booking.id);

      expect(result.refundAmount).toBe(3000);
      const stored = await payments.findById(payment.id);
      expect(stored?.status).toBe('refunded');
      expect(stored?.refundedAmount).toBe(3000);
    });

    it('saves the cancelled booking', async () => {
      const { booking } = await paidBooking();

      await cancellationWith(new FullRefundPolicy()).cancel(booking.id);

      expect(await statusOf(booking.id)).toBe('cancelled');
    });

    it('pays nothing back when the policy says zero, leaving the payment as it was', async () => {
      const { booking, payment } = await paidBooking();

      const result = await cancellationWith(new NoRefundPolicy()).cancel(booking.id);

      expect(result.booking.status).toBe('cancelled');
      expect(result.refundAmount).toBe(0);
      expect(result.refundStatus).toBe('none');
      expect(gateway.refunds).toEqual([]);
      expect((await payments.findById(payment.id))?.status).toBe('success');
    });

    it('gives the policy the booking, what was paid and the current time', async () => {
      const { booking } = await paidBooking();
      const asked: CancellationContext[] = [];

      await cancellationWith({ refundFor: (context) => (asked.push(context), 0) }).cancel(booking.id);

      expect(asked).toHaveLength(1);
      expect(asked[0]?.booking.id).toBe(booking.id);
      expect(asked[0]?.paidAmount).toBe(8000);
      expect(asked[0]?.cancelledAt).toEqual(now);
    });

    it('lets another guest book the room afterwards', async () => {
      const { booking } = await paidBooking();
      await cancellationWith(new FullRefundPolicy()).cancel(booking.id);

      const next = await bookingService.book({
        guestId: 51,
        propertyId: 1,
        roomType: 'queen',
        guestCount: 2,
        dateRange: stay,
      });

      expect(next.roomId).toBe(101);
    });
  });

  describe('with the standard time-based policy', () => {
    it('refunds in full 9 days before check-in', async () => {
      const { booking } = await paidBooking();

      const result = await cancellationWith(TimeBasedRefundPolicy.standard()).cancel(booking.id);

      expect(result.refundAmount).toBe(8000);
    });

    it('refunds half 3 days before check-in', async () => {
      const { booking } = await paidBooking();
      const later = new CancellationService(
        bookings,
        payments,
        bookingService,
        paymentService,
        TimeBasedRefundPolicy.standard(),
        () => new Date('2026-11-07T10:00:00Z'),
      );

      const result = await later.cancel(booking.id);

      expect(result.refundAmount).toBe(4000);
    });

    it('refunds nothing on the day before check-in', async () => {
      const { booking } = await paidBooking();
      const late = new CancellationService(
        bookings,
        payments,
        bookingService,
        paymentService,
        TimeBasedRefundPolicy.standard(),
        () => new Date('2026-11-09T10:00:00Z'),
      );

      const result = await late.cancel(booking.id);

      expect(result.refundAmount).toBe(0);
      expect(result.booking.status).toBe('cancelled');
    });
  });

  describe('when the refund cannot be made', () => {
    it('still cancels the booking and says the refund failed, so it can be retried', async () => {
      const { booking, payment } = await paidBooking();
      gateway.failRefunds = true;

      const result = await cancellationWith(new FullRefundPolicy()).cancel(booking.id);

      expect(result.booking.status).toBe('cancelled');
      expect(result.refundStatus).toBe('failed');
      expect(result.refundAmount).toBe(8000);
      expect(result.paymentId).toBe(payment.id);
      expect(await availability.check(stay, 101)).toBe(true);
      expect((await payments.findById(payment.id))?.status).toBe('success');
    });

    it('can be paid back later through the payment service', async () => {
      const { booking } = await paidBooking();
      gateway.failRefunds = true;
      const result = await cancellationWith(new FullRefundPolicy()).cancel(booking.id);
      gateway.failRefunds = false;

      const retried = await paymentService.refund(result.paymentId as number, result.refundAmount);

      expect(retried.status).toBe('refunded');
    });
  });

  describe('things that stop the cancellation before anything changes', () => {
    it('throws for an unknown booking', async () => {
      await expect(cancellationWith(new FullRefundPolicy()).cancel(999)).rejects.toThrow(BookingNotFoundError);
    });

    it('throws when the booking is already cancelled, without refunding again', async () => {
      const { booking } = await paidBooking();
      const service = cancellationWith(new FullRefundPolicy());
      await service.cancel(booking.id);

      await expect(service.cancel(booking.id)).rejects.toThrow(InvalidBookingTransitionError);

      expect(gateway.refunds).toHaveLength(1);
    });

    it('throws when the booking has expired', async () => {
      const booking = await pendingBooking();
      await bookingService.expire(booking.id);

      await expect(cancellationWith(new FullRefundPolicy()).cancel(booking.id)).rejects.toThrow(
        InvalidBookingTransitionError,
      );
    });

    it('throws when a confirmed booking has no successful payment, and cancels nothing', async () => {
      const booking = await pendingBooking();
      await bookingService.confirm(booking.id);

      await expect(cancellationWith(new FullRefundPolicy()).cancel(booking.id)).rejects.toThrow(
        NoSuccessfulPaymentError,
      );

      expect(await statusOf(booking.id)).toBe('confirmed');
      expect(await availability.check(stay, 101)).toBe(false);
    });

    it.each([-1, 8001, Number.NaN])(
      'rejects a policy that answers %s, leaving the booking and the money alone',
      async (answer) => {
        const { booking } = await paidBooking();

        await expect(cancellationWith(fixedRefund(answer)).cancel(booking.id)).rejects.toThrow(
          InvalidRefundAmountError,
        );

        expect(await statusOf(booking.id)).toBe('confirmed');
        expect(await availability.check(stay, 101)).toBe(false);
        expect(gateway.refunds).toEqual([]);
      },
    );
  });

  describe('two cancellations at the same time', () => {
    it('cancels once and pays back once', async () => {
      const { booking } = await paidBooking();
      const service = cancellationWith(new FullRefundPolicy());

      const outcomes = await Promise.allSettled([service.cancel(booking.id), service.cancel(booking.id)]);

      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      expect(gateway.refunds).toHaveLength(1);
    });
  });
});
