import { Property } from "../../property/property";
import { PropertyFilter } from "./property-filter";

/** Matches properties in the given locality, ignoring case and surrounding spaces. */
export class LocalityFilter implements PropertyFilter {
  constructor(private readonly locality: string) {}

  matches(property: Property): boolean {
    return (
      property.location.locality.trim().toLowerCase() ===
      this.locality.trim().toLowerCase()
    );
  }
}
