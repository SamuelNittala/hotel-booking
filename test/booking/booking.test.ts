import { describe, expect, it } from 'vitest';
import { Booking, BookingProps } from '../../src/booking/booking';
import { BookingStatus } from '../../src/booking/booking-status';
import { InvalidBookingError, InvalidBookingTransitionError } from '../../src/booking/errors';
import { DateRange } from '../../src/shared/date-range';

const props = (overrides: Partial<BookingProps> = {}): BookingProps => ({
  id: 1,
  guestId: 10,
  propertyId: 20,
  roomId: 30,
  guestCount: 2,
  dateRange: DateRange.of('2026-11-01', '2026-11-03'),
  totalAmount: 5000,
  createdAt: new Date('2026-10-31T10:00:00Z'),
  ...overrides,
});

const bookingIn = (status: BookingStatus): Booking => {
  const booking = Booking.create(props());
  if (status === 'confirmed') booking.confirm();
  if (status === 'cancelled') booking.cancel();
  if (status === 'expired') booking.expire();
  return booking;
};

type Action = 'confirm' | 'cancel' | 'expire';
const resultingStatus: Record<Action, BookingStatus> = {
  confirm: 'confirmed',
  cancel: 'cancelled',
  expire: 'expired',
};

describe('Booking.create', () => {
  it('creates a pending booking with the given details', () => {
    const input = props();

    const booking = Booking.create(input);

    expect(booking.status).toBe('pending');
    expect(booking.id).toBe(1);
    expect(booking.guestId).toBe(10);
    expect(booking.propertyId).toBe(20);
    expect(booking.roomId).toBe(30);
    expect(booking.guestCount).toBe(2);
    expect(booking.dateRange).toBe(input.dateRange);
    expect(booking.totalAmount).toBe(5000);
    expect(booking.createdAt).toBe(input.createdAt);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects a guest count of %s', (guestCount) => {
    expect(() => Booking.create(props({ guestCount }))).toThrow(InvalidBookingError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a total amount of %s', (totalAmount) => {
    expect(() => Booking.create(props({ totalAmount }))).toThrow(InvalidBookingError);
  });

  it('accepts a total amount of zero', () => {
    expect(() => Booking.create(props({ totalAmount: 0 }))).not.toThrow();
  });
});

describe('Booking status moves', () => {
  describe('legal moves', () => {
    it.each<[BookingStatus, Action]>([
      ['pending', 'confirm'],
      ['pending', 'cancel'],
      ['pending', 'expire'],
      ['confirmed', 'cancel'],
    ])('a %s booking can %s', (from, action) => {
      const booking = bookingIn(from);

      booking[action]();

      expect(booking.status).toBe(resultingStatus[action]);
    });
  });

  describe('illegal moves', () => {
    it.each<[BookingStatus, Action]>([
      ['confirmed', 'confirm'],
      ['confirmed', 'expire'],
      ['cancelled', 'confirm'],
      ['cancelled', 'cancel'],
      ['cancelled', 'expire'],
      ['expired', 'confirm'],
      ['expired', 'cancel'],
      ['expired', 'expire'],
    ])('a %s booking cannot %s', (from, action) => {
      const booking = bookingIn(from);

      expect(() => booking[action]()).toThrow(InvalidBookingTransitionError);
    });

    it('leaves the status unchanged after an illegal move', () => {
      const booking = bookingIn('cancelled');

      expect(() => booking.confirm()).toThrow(InvalidBookingTransitionError);

      expect(booking.status).toBe('cancelled');
    });

    it('names the booking and both statuses in the error', () => {
      const booking = bookingIn('expired');

      expect(() => booking.confirm()).toThrow('Booking 1 cannot move from expired to confirmed');
    });
  });
});
