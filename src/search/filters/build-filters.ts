import { SearchCriteria } from '../search-criteria';
import { AmenitiesFilter } from './amenities-filter';
import { GuestCountFilter } from './guest-count-filter';
import { LocalityFilter } from './locality-filter';
import { MinNightsFilter } from './min-nights-filter';
import { PriceRangeFilter } from './price-range-filter';
import { PropertyFilter } from './property-filter';
import { RoomFilter } from './room-filter';
import { RoomTypeFilter } from './room-type-filter';
import { StarRatingFilter } from './star-rating-filter';

/**
 * Turns the criteria into property filters. Only criteria the guest gave produce a filter,
 * except the minimum-stay filter, which always applies because it depends on the dates.
 * This and `buildRoomFilters` are the only places to touch when a new filter is added.
 */
export function buildPropertyFilters(criteria: SearchCriteria): PropertyFilter[] {
  const propertyFilters : PropertyFilter[] = [new MinNightsFilter(criteria.dateRange)];
  if (criteria.locality) {
    propertyFilters.push(new LocalityFilter(criteria.locality));
  }
  if (criteria.amenities) {
    propertyFilters.push(new AmenitiesFilter(criteria.amenities));
  }
  if (criteria.minStarRating) {
    propertyFilters.push(new StarRatingFilter(criteria.minStarRating));
  }
  return propertyFilters;
}

/** Turns the criteria into room filters. The guest count always applies. */
export function buildRoomFilters(criteria: SearchCriteria): RoomFilter[] {
  const roomFilters: RoomFilter[] = [new GuestCountFilter(criteria.guestCount)];
  if (criteria.minPrice || criteria.maxPrice) {
    roomFilters.push(new PriceRangeFilter(criteria.minPrice, criteria.maxPrice))
  }
  if (criteria.roomType) {
    roomFilters.push(new RoomTypeFilter(criteria.roomType));
  }
  return roomFilters;
}
