import { Property } from "../../property/property";
import { PropertyFilter } from "./property-filter";

/** Matches properties that have every one of the wanted amenities. Names are compared trimmed and lower-cased. */
export class AmenitiesFilter implements PropertyFilter {
  constructor(private readonly wanted: readonly string[]) {}

  matches(property: Property): boolean {
    return this.wanted.every((wanted) =>
      property.amenities.has(wanted.trim().toLowerCase()),
    );
  }
}
