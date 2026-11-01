import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryAvailability } from '../../src/availability/in-memory-availability';
import { BookingExpiryService } from '../../src/booking/booking-expiry-service';
import { BookingService } from '../../src/booking/booking-service';
import { InvalidBookingError, InvalidBookingTransitionError } from '../../src/booking/errors';
import { InMemoryBookingRepository } from '../../src/booking/in-memory-booking-repository';
import { InMemoryPropertyRepository } from '../../src/property/in-memory-property-repository';
import { Property } from '../../src/property/property';
import { PropertyLocation } from '../../src/property/property-location';
import { Room } from '../../src/property/room';
import { DateRange } from '../../src/shared/date-range';
import { SequentialIdGenerator } from '../../src/shared/sequential-id-generator';

const stay = DateRange.of('2026-11-10', '2026-11-12');
const minutes = (count: number) => count * 60 * 1000;

describe('BookingExpiryService', () => {
  let clock: Date;
  let bookings: InMemoryBookingRepository;
  let availability: InMemoryAvailability;
  let bookingService: BookingService;
  let expiry: BookingExpiryService;

  beforeEach(async () => {
    clock = new Date('2026-11-01T10:00:00Z');
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
        rooms: [101, 102, 103].map((id) => Room.create({ id, type: 'queen', capacity: 2, pricePerNight: 4000 })),
      }),
    );
    bookingService = new BookingService(properties, bookings, availability, new SequentialIdGenerator(), () => clock);
    expiry = new BookingExpiryService(bookings, bookingService, undefined, () => clock);
  });

  const book = () =>
    bookingService.book({ guestId: 50, propertyId: 1, roomType: 'queen', guestCount: 2, dateRange: stay });

  const advance = (ms: number) => {
    clock = new Date(clock.getTime() + ms);
  };

  const statusOf = async (bookingId: number) => (await bookings.findById(bookingId))?.status;

  describe('overdue bookings', () => {
    it('expires a pending booking older than the payment window, saves it and frees its dates', async () => {
      const booking = await book();
      advance(minutes(16));

      await expiry.expireOverdue();

      expect(await statusOf(booking.id)).toBe('expired');
      expect(await availability.check(stay, booking.roomId)).toBe(true);
    });

    it('reports which bookings it expired', async () => {
      const first = await book();
      const second = await book();
      advance(minutes(16));

      const result = await expiry.expireOverdue();

      expect([...result.expired].sort()).toEqual([first.id, second.id].sort());
      expect(result.skipped).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('leaves a booking that is still inside the window', async () => {
      const booking = await book();
      advance(minutes(14));

      const result = await expiry.expireOverdue();

      expect(await statusOf(booking.id)).toBe('pending');
      expect(result.expired).toEqual([]);
    });

    it('leaves a booking that is exactly as old as the window', async () => {
      const booking = await book();
      advance(minutes(15));

      await expiry.expireOverdue();

      expect(await statusOf(booking.id)).toBe('pending');
    });

    it('expires only the old ones when old and new bookings are mixed', async () => {
      const old = await book();
      advance(minutes(10));
      const recent = await book();
      advance(minutes(10));

      await expiry.expireOverdue();

      expect(await statusOf(old.id)).toBe('expired');
      expect(await statusOf(recent.id)).toBe('pending');
    });

    it('leaves confirmed and cancelled bookings alone, however old', async () => {
      const paid = await book();
      await bookingService.confirm(paid.id);
      const cancelled = await book();
      await bookingService.cancel(cancelled.id);
      advance(minutes(60));

      const result = await expiry.expireOverdue();

      expect(await statusOf(paid.id)).toBe('confirmed');
      expect(await availability.check(stay, paid.roomId)).toBe(false);
      expect(await statusOf(cancelled.id)).toBe('cancelled');
      expect(result.expired).toEqual([]);
    });

    it('lets another guest book the room once its booking has expired', async () => {
      const booking = await book();
      advance(minutes(16));
      await expiry.expireOverdue();

      const next = await book();

      expect(next.roomId).toBe(booking.roomId);
    });

    it('does nothing when there are no bookings', async () => {
      expect(await expiry.expireOverdue()).toEqual({ expired: [], skipped: [], failed: [] });
    });

    it('is safe to repeat: the second sweep finds nothing', async () => {
      await book();
      advance(minutes(16));
      await expiry.expireOverdue();

      const second = await expiry.expireOverdue();

      expect(second).toEqual({ expired: [], skipped: [], failed: [] });
    });
  });

  describe('the payment window', () => {
    it('uses the window it was given', async () => {
      const strict = new BookingExpiryService(bookings, bookingService, 5, () => clock);
      const booking = await book();
      advance(minutes(6));

      await strict.expireOverdue();

      expect(await statusOf(booking.id)).toBe('expired');
    });

    it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects a window of %s minutes', (window) => {
      expect(() => new BookingExpiryService(bookings, bookingService, window)).toThrow(InvalidBookingError);
    });
  });

  describe('when things change or go wrong during the sweep', () => {
    it('skips a booking that was paid after the list was read, and still expires the others', async () => {
      const paidJustNow = await book();
      const abandoned = await book();
      advance(minutes(16));
      const realExpire = bookingService.expire.bind(bookingService);
      vi.spyOn(bookingService, 'expire').mockImplementation(async (bookingId) => {
        if (bookingId === paidJustNow.id) {
          throw new InvalidBookingTransitionError(bookingId, 'confirmed', 'expired');
        }
        return realExpire(bookingId);
      });

      const result = await expiry.expireOverdue();

      expect(result.skipped).toEqual([paidJustNow.id]);
      expect(result.expired).toEqual([abandoned.id]);
      expect(result.failed).toEqual([]);
    });

    it('records a booking it could not expire and carries on with the rest', async () => {
      const broken = await book();
      const fine = await book();
      advance(minutes(16));
      const realExpire = bookingService.expire.bind(bookingService);
      const failure = new Error('database down');
      vi.spyOn(bookingService, 'expire').mockImplementation(async (bookingId) => {
        if (bookingId === broken.id) throw failure;
        return realExpire(bookingId);
      });

      const result = await expiry.expireOverdue();

      expect(result.failed).toEqual([{ bookingId: broken.id, error: failure }]);
      expect(result.expired).toEqual([fine.id]);
      expect(await statusOf(broken.id)).toBe('pending');
    });

    it('tries a failed booking again on the next sweep', async () => {
      const booking = await book();
      advance(minutes(16));
      vi.spyOn(bookingService, 'expire').mockRejectedValueOnce(new Error('database down'));
      await expiry.expireOverdue();

      const second = await expiry.expireOverdue();

      expect(second.expired).toEqual([booking.id]);
      expect(await statusOf(booking.id)).toBe('expired');
    });
  });
});
