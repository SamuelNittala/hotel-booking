import { DateRange } from '../shared/date-range';

/** What a guest asks for. Only `city`, `dateRange` and `guestCount` are required. */
export type SearchCriteria = {
  city: string;
  locality?: string;
  /** Check-in (inclusive) to check-out (exclusive). */
  dateRange: DateRange;
  guestCount: number;
  /** Price per night, inclusive at both ends. */
  minPrice?: number;
  maxPrice?: number;
  /** The property must have all of these. */
  amenities?: readonly string[];
  /** The property's star rating must be at least this. */
  minStarRating?: number;
  roomType?: string;
};
