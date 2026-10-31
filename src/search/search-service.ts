import { Availability } from "../availability/availability";
import { PropertyRepository } from "../property/property-repository";
import {
  buildPropertyFilters,
  buildRoomFilters,
} from "./filters/build-filters";
import { SearchCriteria } from "./search-criteria";
import { RoomOffer, SearchResult } from "./search-result";

/** Finds the properties and rooms a guest can book for the requested dates. */
export class SearchService {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly availability: Availability,
  ) {}

  async search(criteria: SearchCriteria): Promise<readonly SearchResult[]> {
    const nights = criteria.dateRange.nights();

    const cityProperties = await this.properties.findByCity(criteria.city);

    const propertyFilters = buildPropertyFilters(criteria);
    const roomFilters = buildRoomFilters(criteria);

    const candidates = cityProperties
      .filter((property) =>
        propertyFilters.every((filter) => filter.matches(property)),
      )
      .map((property) => ({
        property,
        rooms: property.rooms.filter((room) =>
          roomFilters.every((filter) => filter.matches(room)),
        ),
      }))
      .filter((candidate) => candidate.rooms.length > 0);

    const results = await Promise.all(
      candidates.map(async ({ property, rooms }): Promise<SearchResult> => {
        const isFree = await Promise.all(
          rooms.map((room) =>
            this.availability.check(criteria.dateRange, room.id),
          ),
        );
        const offers: RoomOffer[] = rooms
          .filter((_, index) => isFree[index])
          .map((room) => ({
            room,
            totalPrice: room.pricePerNight * nights,
          }));
        return { property, rooms: offers };
      }),
    );

    return results.filter((result) => result.rooms.length > 0);
  }
}
