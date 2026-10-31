import { Room } from "../../property/room";
import { RoomFilter } from "./room-filter";

/** Matches rooms whose price per night is within the range, inclusive. Either end can be left out. */
export class PriceRangeFilter implements RoomFilter {
  constructor(
    private readonly minPrice: number | undefined,
    private readonly maxPrice: number | undefined,
  ) {}

  matches(room: Room): boolean {
    if (this.minPrice === undefined && this.maxPrice === undefined) return true;

    if (this.minPrice === undefined)
      return room.pricePerNight <= this.maxPrice!;
    if (this.maxPrice === undefined) return room.pricePerNight >= this.minPrice;

    return (
      room.pricePerNight >= this.minPrice && room.pricePerNight <= this.maxPrice
    );
  }
}
