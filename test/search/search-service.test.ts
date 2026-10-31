import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAvailability } from '../../src/availability/in-memory-availability';
import { InMemoryPropertyRepository } from '../../src/property/in-memory-property-repository';
import { Property } from '../../src/property/property';
import { PropertyLocation } from '../../src/property/property-location';
import { Room } from '../../src/property/room';
import { SearchCriteria } from '../../src/search/search-criteria';
import { SearchResult } from '../../src/search/search-result';
import { SearchService } from '../../src/search/search-service';
import { DateRange } from '../../src/shared/date-range';

type RoomSpec = { id: number; type?: string; capacity?: number; pricePerNight?: number };

const room = (spec: RoomSpec) =>
  Room.create({
    id: spec.id,
    type: spec.type ?? 'queen',
    capacity: spec.capacity ?? 2,
    pricePerNight: spec.pricePerNight ?? 4000,
  });

const property = (
  id: number,
  rooms: RoomSpec[],
  overrides: { city?: string; locality?: string; starRating?: number; amenities?: string[]; minNights?: number } = {},
): Property =>
  Property.create({
    id,
    name: `Property ${id}`,
    ownerId: 7,
    location: PropertyLocation.of({
      city: overrides.city ?? 'Bengaluru',
      locality: overrides.locality ?? 'Indiranagar',
      latitude: 12.97,
      longitude: 77.64,
    }),
    amenities: overrides.amenities ?? ['wifi'],
    starRating: overrides.starRating ?? 4,
    minNights: overrides.minNights,
    rooms: rooms.map(room),
  });

const stay = DateRange.of('2026-11-01', '2026-11-03');

const criteria = (overrides: Partial<SearchCriteria> = {}): SearchCriteria => ({
  city: 'Bengaluru',
  dateRange: stay,
  guestCount: 2,
  ...overrides,
});

const propertyIds = (results: readonly SearchResult[]) => results.map((result) => result.property.id).sort();
const roomIds = (result: SearchResult | undefined) => result?.rooms.map((offer) => offer.room.id).sort();

describe('SearchService', () => {
  let properties: InMemoryPropertyRepository;
  let availability: InMemoryAvailability;
  let service: SearchService;

  beforeEach(() => {
    properties = new InMemoryPropertyRepository();
    availability = new InMemoryAvailability();
    service = new SearchService(properties, availability);
  });

  describe('city', () => {
    it('returns only properties in the searched city', async () => {
      await properties.save(property(1, [{ id: 101 }], { city: 'Bengaluru' }));
      await properties.save(property(2, [{ id: 201 }], { city: 'Mumbai' }));

      expect(propertyIds(await service.search(criteria()))).toEqual([1]);
    });

    it('ignores case and spaces in the city', async () => {
      await properties.save(property(1, [{ id: 101 }]));

      expect(propertyIds(await service.search(criteria({ city: '  bengaluru ' })))).toEqual([1]);
    });

    it('returns an empty list when no property is in the city', async () => {
      await properties.save(property(1, [{ id: 101 }], { city: 'Mumbai' }));

      expect(await service.search(criteria())).toEqual([]);
    });

    it('leaves out a property that has no rooms', async () => {
      await properties.save(property(1, []));

      expect(await service.search(criteria())).toEqual([]);
    });
  });

  describe('rooms and prices', () => {
    it('prices each room for the whole stay', async () => {
      await properties.save(property(1, [{ id: 101, pricePerNight: 4000 }]));

      const [result] = await service.search(criteria({ dateRange: DateRange.of('2026-11-01', '2026-11-04') }));

      expect(result?.rooms.map((offer) => offer.totalPrice)).toEqual([12000]);
    });

    it('does not use the property minimum stay as the number of nights', async () => {
      await properties.save(property(1, [{ id: 101, pricePerNight: 1000 }], { minNights: 2 }));

      const [result] = await service.search(criteria({ dateRange: DateRange.of('2026-11-01', '2026-11-06') }));

      expect(result?.rooms[0]?.totalPrice).toBe(5000);
    });

    it('returns only the rooms that pass the room filters', async () => {
      await properties.save(property(1, [{ id: 101, capacity: 2 }, { id: 102, capacity: 4 }]));

      const results = await service.search(criteria({ guestCount: 3 }));

      expect(roomIds(results[0])).toEqual([102]);
    });

    it('returns the real property object, not a copy', async () => {
      const stored = property(1, [{ id: 101 }]);
      await properties.save(stored);

      const [result] = await service.search(criteria());

      expect(result?.property).toBe(stored);
    });

    it('filters by room type', async () => {
      await properties.save(property(1, [{ id: 101, type: 'queen' }, { id: 102, type: 'suite' }]));

      const results = await service.search(criteria({ roomType: 'Suite' }));

      expect(roomIds(results[0])).toEqual([102]);
    });
  });

  describe('room filters apply to the same room', () => {
    it('leaves out a property where one room is too small and another too expensive', async () => {
      await properties.save(
        property(1, [
          { id: 101, capacity: 4, pricePerNight: 9000 },
          { id: 102, capacity: 1, pricePerNight: 2000 },
        ]),
      );

      const results = await service.search(criteria({ guestCount: 3, maxPrice: 5000 }));

      expect(results).toEqual([]);
    });

    it('returns a property where one room satisfies every room filter', async () => {
      await properties.save(
        property(1, [
          { id: 101, capacity: 4, pricePerNight: 9000 },
          { id: 102, capacity: 4, pricePerNight: 4500 },
          { id: 103, capacity: 1, pricePerNight: 2000 },
        ]),
      );

      const results = await service.search(criteria({ guestCount: 3, maxPrice: 5000 }));

      expect(roomIds(results[0])).toEqual([102]);
    });
  });

  describe('property filters', () => {
    it('filters by minimum star rating', async () => {
      await properties.save(property(1, [{ id: 101 }], { starRating: 5 }));
      await properties.save(property(2, [{ id: 201 }], { starRating: 3 }));

      expect(propertyIds(await service.search(criteria({ minStarRating: 4 })))).toEqual([1]);
    });

    it('filters by amenities, requiring all of them', async () => {
      await properties.save(property(1, [{ id: 101 }], { amenities: ['wifi', 'pool'] }));
      await properties.save(property(2, [{ id: 201 }], { amenities: ['wifi'] }));

      expect(propertyIds(await service.search(criteria({ amenities: ['WiFi', 'pool'] })))).toEqual([1]);
    });

    it('filters by locality', async () => {
      await properties.save(property(1, [{ id: 101 }], { locality: 'Indiranagar' }));
      await properties.save(property(2, [{ id: 201 }], { locality: 'Koramangala' }));

      expect(propertyIds(await service.search(criteria({ locality: 'koramangala' })))).toEqual([2]);
    });

    it('leaves out properties whose minimum stay is longer than the searched stay', async () => {
      await properties.save(property(1, [{ id: 101 }], { minNights: 3 }));
      await properties.save(property(2, [{ id: 201 }], { minNights: 2 }));

      expect(propertyIds(await service.search(criteria()))).toEqual([2]);
    });
  });

  describe('availability', () => {
    it('leaves out a room that is booked for overlapping dates, and keeps the others', async () => {
      await properties.save(property(1, [{ id: 101 }, { id: 102 }]));
      await availability.reserve(DateRange.of('2026-11-02', '2026-11-04'), 101, 1);

      const results = await service.search(criteria());

      expect(roomIds(results[0])).toEqual([102]);
    });

    it('leaves out a property when all its matching rooms are booked', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      await availability.reserve(stay, 101, 1);

      expect(await service.search(criteria())).toEqual([]);
    });

    it('offers a room on the day another guest checks out', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      await availability.reserve(DateRange.of('2026-10-30', '2026-11-01'), 101, 1);

      expect(propertyIds(await service.search(criteria()))).toEqual([1]);
    });

    it('ignores bookings for other dates', async () => {
      await properties.save(property(1, [{ id: 101 }]));
      await availability.reserve(DateRange.of('2026-12-01', '2026-12-05'), 101, 1);

      expect(propertyIds(await service.search(criteria()))).toEqual([1]);
    });

    it('does not reserve anything itself', async () => {
      await properties.save(property(1, [{ id: 101 }]));

      await service.search(criteria());

      expect(await availability.check(stay, 101)).toBe(true);
    });

    it('does not check availability for rooms that already failed a filter', async () => {
      await properties.save(property(1, [{ id: 101, capacity: 1 }]));
      const checked: number[] = [];
      const spying = {
        check: async (dateRange: DateRange, roomId: number) => {
          checked.push(roomId);
          return availability.check(dateRange, roomId);
        },
        reserve: availability.reserve.bind(availability),
        release: availability.release.bind(availability),
      };

      await new SearchService(properties, spying).search(criteria({ guestCount: 2 }));

      expect(checked).toEqual([]);
    });
  });
});
