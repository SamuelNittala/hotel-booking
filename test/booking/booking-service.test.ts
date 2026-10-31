import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryAvailability } from '../../src/availability/in-memory-availability';
import { BookRoomRequest, BookingService } from '../../src/booking/booking-service';
import {
  BookingNotFoundError,
  InvalidBookingTransitionError,
  NoMatchingRoomError,
  NoRoomAvailableError,
  StayTooShortError,
} from '../../src/booking/errors';
import { InMemoryBookingRepository } from '../../src/booking/in-memory-booking-repository';
import { PropertyNotFoundError } from '../../src/property/errors';
import { InMemoryPropertyRepository } from '../../src/property/in-memory-property-repository';
import { Property } from '../../src/property/property';
import { PropertyLocation } from '../../src/property/property-location';
import { Room } from '../../src/property/room';
import { DateRange } from '../../src/shared/date-range';
import { SequentialIdGenerator } from '../../src/shared/sequential-id-generator';

type RoomSpec = { id: number; type?: string; capacity?: number; pricePerNight?: number };

const property = (id: number, rooms: RoomSpec[], minNights?: number): Property =>
  Property.create({
    id,
    name: `Property ${id}`,
    ownerId: 7,
    location: PropertyLocation.of({ city: 'Bengaluru', locality: 'Indiranagar', latitude: 12.97, longitude: 77.64 }),
    amenities: ['wifi'],
    starRating: 4,
    minNights,
    rooms: rooms.map((spec) =>
      Room.create({
        id: spec.id,
        type: spec.type ?? 'queen',
        capacity: spec.capacity ?? 2,
        pricePerNight: spec.pricePerNight ?? 4000,
      }),
    ),
  });

const stay = DateRange.of('2026-11-10', '2026-11-12');
const now = new Date('2026-11-01T10:00:00Z');

const request = (overrides: Partial<BookRoomRequest> = {}): BookRoomRequest => ({
  guestId: 50,
  propertyId: 1,
  roomType: 'queen',
  guestCount: 2,
  dateRange: stay,
  ...overrides,
});

describe('BookingService', () => {
  let properties: InMemoryPropertyRepository;
  let bookings: InMemoryBookingRepository;
  let availability: InMemoryAvailability;
  let service: BookingService;

  beforeEach(() => {
    properties = new InMemoryPropertyRepository();
    bookings = new InMemoryBookingRepository();
    availability = new InMemoryAvailability();
    service = new BookingService(properties, bookings, availability, new SequentialIdGenerator(), () => now);
  });

  describe('book', () => {
    it('creates a pending booking with the details of the request', async () => {
      await properties.save(property(1, [{ id: 101, pricePerNight: 4000 }]));

      const booking = await service.book(request());

      expect(booking.status).toBe('pending');
      expect(booking.guestId).toBe(50);
      expect(booking.propertyId).toBe(1);
      expect(booking.roomId).toBe(101);
      expect(booking.guestCount).toBe(2);
      expect(booking.dateRange).toBe(stay);
      expect(booking.createdAt).toEqual(now);
    });

    it('prices the booking for the whole stay', async () => {
      await properties.save(property(1, [{ id: 101, pricePerNight: 4000 }]));

      const booking = await service.book(request({ dateRange: DateRange.of('2026-11-10', '2026-11-13') }));

      expect(booking.totalAmount).toBe(12000);
    });

    it('saves the booking', async () => {
      await properties.save(property(1, [{ id: 101 }]));

      const booking = await service.book(request());

      expect(await bookings.findById(booking.id)).toBe(booking);
    });

    it('holds the dates for the booked room straight away', async () => {
      await properties.save(property(1, [{ id: 101 }]));

      await service.book(request());

      expect(await availability.check(stay, 101)).toBe(false);
    });

    it('gives each booking its own id', async () => {
      await properties.save(property(1, [{ id: 101 }, { id: 102 }]));

      const first = await service.book(request());
      const second = await service.book(request());

      expect(first.id).not.toBe(second.id);
    });

    it('matches the room type ignoring case and spaces', async () => {
      await properties.save(property(1, [{ id: 101, type: 'queen' }]));

      const booking = await service.book(request({ roomType: '  QUEEN ' }));

      expect(booking.roomId).toBe(101);
    });

    it('picks a room of the requested type, skipping other types', async () => {
      await properties.save(property(1, [{ id: 101, type: 'suite', capacity: 4 }, { id: 102, type: 'queen' }]));

      const booking = await service.book(request({ roomType: 'queen' }));

      expect(booking.roomId).toBe(102);
    });

    it('picks a room that fits the guests', async () => {
      await properties.save(property(1, [{ id: 101, capacity: 2 }, { id: 102, capacity: 4 }]));

      const booking = await service.book(request({ guestCount: 3 }));

      expect(booking.roomId).toBe(102);
    });

    it('moves on to the next room when the first is taken for those dates', async () => {
      await properties.save(property(1, [{ id: 101 }, { id: 102 }]));
      await availability.reserve(DateRange.of('2026-11-11', '2026-11-13'), 101, 999);

      const booking = await service.book(request());

      expect(booking.roomId).toBe(102);
    });

    it('books a room on the day another guest checks out', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      await availability.reserve(DateRange.of('2026-11-08', '2026-11-10'), 101, 999);

      const booking = await service.book(request());

      expect(booking.roomId).toBe(101);
    });

    it('fills the rooms one after another, then runs out', async () => {
      await properties.save(property(1, [{ id: 101 }, { id: 102 }]));

      const first = await service.book(request());
      const second = await service.book(request());

      expect([first.roomId, second.roomId]).toEqual([101, 102]);
      await expect(service.book(request())).rejects.toThrow(NoRoomAvailableError);
    });

    it('lets the same room be booked for different dates', async () => {
      await properties.save(property(1, [{ id: 101 }]));

      await service.book(request());
      const later = await service.book(request({ dateRange: DateRange.of('2026-11-12', '2026-11-14') }));

      expect(later.roomId).toBe(101);
    });

    describe('rejections', () => {
      it('throws when the property does not exist', async () => {
        await expect(service.book(request({ propertyId: 999 }))).rejects.toThrow(PropertyNotFoundError);
      });

      it('throws when the stay is shorter than the property minimum', async () => {
        await properties.save(property(1, [{ id: 101 }], 3));

        await expect(service.book(request())).rejects.toThrow(StayTooShortError);
      });

      it('throws when the property has no room of that type', async () => {
        await properties.save(property(1, [{ id: 101, type: 'queen' }]));

        await expect(service.book(request({ roomType: 'suite' }))).rejects.toThrow(NoMatchingRoomError);
      });

      it('throws when no room of that type holds that many guests', async () => {
        await properties.save(property(1, [{ id: 101, capacity: 2 }]));

        await expect(service.book(request({ guestCount: 3 }))).rejects.toThrow(NoMatchingRoomError);
      });

      it('throws when every matching room is taken for the dates', async () => {
        await properties.save(property(1, [{ id: 101 }]));
        await availability.reserve(stay, 101, 999);

        await expect(service.book(request())).rejects.toThrow(NoRoomAvailableError);
      });

      it('saves and holds nothing when it throws', async () => {
        await properties.save(property(1, [{ id: 101 }], 3));

        await service.book(request()).catch(() => undefined);

        expect(await bookings.findByGuestId(50)).toEqual([]);
        expect(await availability.check(stay, 101)).toBe(true);
      });
    });

    describe('two guests at the same time', () => {
      it('gives the last room to one guest and refuses the other', async () => {
        await properties.save(property(1, [{ id: 101 }]));

        const outcomes = await Promise.allSettled([
          service.book(request({ guestId: 1 })),
          service.book(request({ guestId: 2 })),
        ]);

        expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
        const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
        expect(rejected).toHaveLength(1);
        expect(rejected[0]?.reason).toBeInstanceOf(NoRoomAvailableError);
      });

      it('stores only the booking that won', async () => {
        await properties.save(property(1, [{ id: 101 }]));

        await Promise.allSettled([service.book(request({ guestId: 1 })), service.book(request({ guestId: 2 }))]);

        const stored = [...(await bookings.findByGuestId(1)), ...(await bookings.findByGuestId(2))];
        expect(stored).toHaveLength(1);
      });

      it('gives different rooms to guests who arrive together when there are enough rooms', async () => {
        await properties.save(property(1, [{ id: 101 }, { id: 102 }]));

        const outcomes = await Promise.allSettled([
          service.book(request({ guestId: 1 })),
          service.book(request({ guestId: 2 })),
          service.book(request({ guestId: 3 })),
        ]);

        const fulfilled = outcomes.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : []));
        expect(fulfilled.map((booking) => booking.roomId).sort()).toEqual([101, 102]);
        expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
      });
    });

    it('gives the dates back when the booking cannot be saved', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      vi.spyOn(bookings, 'save').mockRejectedValue(new Error('database down'));

      await expect(service.book(request())).rejects.toThrow('database down');

      expect(await availability.check(stay, 101)).toBe(true);
    });
  });

  describe('confirm', () => {
    it('moves a pending booking to confirmed and saves it', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());

      await service.confirm(booking.id);

      expect((await bookings.findById(booking.id))?.status).toBe('confirmed');
    });

    it('keeps the dates held', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());

      await service.confirm(booking.id);

      expect(await availability.check(stay, 101)).toBe(false);
    });

    it('throws for an unknown booking', async () => {
      await expect(service.confirm(999)).rejects.toThrow(BookingNotFoundError);
    });

    it('throws for a booking that is already cancelled', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());
      await service.cancel(booking.id);

      await expect(service.confirm(booking.id)).rejects.toThrow(InvalidBookingTransitionError);
    });
  });

  describe('cancel', () => {
    it('cancels a confirmed booking and saves it', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());
      await service.confirm(booking.id);

      await service.cancel(booking.id);

      expect((await bookings.findById(booking.id))?.status).toBe('cancelled');
    });

    it('cancels a pending booking', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());

      const cancelled = await service.cancel(booking.id);

      expect(cancelled.status).toBe('cancelled');
    });

    it('frees the dates so another guest can book the room', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());

      await service.cancel(booking.id);

      expect(await availability.check(stay, 101)).toBe(true);
      const next = await service.book(request({ guestId: 51 }));
      expect(next.roomId).toBe(101);
    });

    it('throws for an unknown booking', async () => {
      await expect(service.cancel(999)).rejects.toThrow(BookingNotFoundError);
    });

    it('throws when cancelling twice', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());
      await service.cancel(booking.id);

      await expect(service.cancel(booking.id)).rejects.toThrow(InvalidBookingTransitionError);
    });
  });

  describe('expire', () => {
    it('expires a pending booking, saves it and frees the dates', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());

      await service.expire(booking.id);

      expect((await bookings.findById(booking.id))?.status).toBe('expired');
      expect(await availability.check(stay, 101)).toBe(true);
    });

    it('refuses to expire a confirmed booking and keeps its dates', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      const booking = await service.book(request());
      await service.confirm(booking.id);

      await expect(service.expire(booking.id)).rejects.toThrow(InvalidBookingTransitionError);

      expect((await bookings.findById(booking.id))?.status).toBe('confirmed');
      expect(await availability.check(stay, 101)).toBe(false);
    });

    it('throws for an unknown booking', async () => {
      await expect(service.expire(999)).rejects.toThrow(BookingNotFoundError);
    });
  });
});
