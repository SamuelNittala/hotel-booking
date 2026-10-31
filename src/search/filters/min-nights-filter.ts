import { Property } from '../../property/property';
import { DateRange } from '../../shared/date-range';
import { PropertyFilter } from './property-filter';

/** Matches properties whose minimum stay is no longer than the searched stay. */
export class MinNightsFilter implements PropertyFilter {
  constructor(private readonly dateRange: DateRange) {}

  matches(property: Property): boolean {
    const numNights = this.dateRange.nights();
    return numNights >= property.minNights;
  }
}
