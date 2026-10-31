import { describe, expect, it } from 'vitest';
import { AmenitiesFilter } from '../../../src/search/filters/amenities-filter';
import { buildPropertyFilters, buildRoomFilters } from '../../../src/search/filters/build-filters';
import { GuestCountFilter } from '../../../src/search/filters/guest-count-filter';
import { LocalityFilter } from '../../../src/search/filters/locality-filter';
import { MinNightsFilter } from '../../../src/search/filters/min-nights-filter';
import { PriceRangeFilter } from '../../../src/search/filters/price-range-filter';
import { RoomTypeFilter } from '../../../src/search/filters/room-type-filter';
import { StarRatingFilter } from '../../../src/search/filters/star-rating-filter';
import { SearchCriteria } from '../../../src/search/search-criteria';
import { DateRange } from '../../../src/shared/date-range';

const criteria = (overrides: Partial<SearchCriteria> = {}): SearchCriteria => ({
  city: 'Bengaluru',
  dateRange: DateRange.of('2026-11-01', '2026-11-03'),
  guestCount: 2,
  ...overrides,
});

const hasFilter = (filters: readonly object[], type: new (...args: never[]) => object) =>
  filters.some((filter) => filter instanceof type);

describe('buildPropertyFilters', () => {
  it('always applies the minimum stay and nothing else when only the required criteria are given', () => {
    const filters = buildPropertyFilters(criteria());

    expect(filters).toHaveLength(1);
    expect(filters[0]).toBeInstanceOf(MinNightsFilter);
  });

  it('adds a locality filter when a locality is given', () => {
    expect(hasFilter(buildPropertyFilters(criteria({ locality: 'Indiranagar' })), LocalityFilter)).toBe(true);
  });

  it('adds an amenities filter when amenities are given', () => {
    expect(hasFilter(buildPropertyFilters(criteria({ amenities: ['wifi'] })), AmenitiesFilter)).toBe(true);
  });

  it('adds a star rating filter when a minimum rating is given', () => {
    expect(hasFilter(buildPropertyFilters(criteria({ minStarRating: 4 })), StarRatingFilter)).toBe(true);
  });

  it('adds every filter when every criterion is given', () => {
    const filters = buildPropertyFilters(criteria({ locality: 'Indiranagar', amenities: ['wifi'], minStarRating: 4 }));

    expect(filters).toHaveLength(4);
  });
});

describe('buildRoomFilters', () => {
  it('always applies the guest count and nothing else when only the required criteria are given', () => {
    const filters = buildRoomFilters(criteria());

    expect(filters).toHaveLength(1);
    expect(filters[0]).toBeInstanceOf(GuestCountFilter);
  });

  it('adds a price filter when only a minimum price is given', () => {
    expect(hasFilter(buildRoomFilters(criteria({ minPrice: 2000 })), PriceRangeFilter)).toBe(true);
  });

  it('adds a price filter when only a maximum price is given', () => {
    expect(hasFilter(buildRoomFilters(criteria({ maxPrice: 5000 })), PriceRangeFilter)).toBe(true);
  });

  it('adds a room type filter when a room type is given', () => {
    expect(hasFilter(buildRoomFilters(criteria({ roomType: 'queen' })), RoomTypeFilter)).toBe(true);
  });
});
