import { Property } from '../../property/property';
import { PropertyFilter } from './property-filter';

/** Matches properties rated at least `minStarRating`. */
export class StarRatingFilter implements PropertyFilter {
  constructor(private readonly minStarRating: number) {}

  matches(property: Property): boolean {
    return property.starRating >= this.minStarRating;
  }
}
