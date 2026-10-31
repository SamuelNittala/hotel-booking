import { Property } from '../../property/property';

/** One condition about a property as a whole. Search keeps a property only if every property filter matches. */
export interface PropertyFilter {
  matches(property: Property): boolean;
}
