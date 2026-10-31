import { Room } from "../../property/room";
import { RoomFilter } from "./room-filter";

/** Matches rooms of the given type, ignoring case and surrounding spaces. */
export class RoomTypeFilter implements RoomFilter {
  constructor(private readonly roomType: string) {}

  matches(room: Room): boolean {
    return (
      room.type.trim().toLocaleLowerCase() ===
      this.roomType.trim().toLocaleLowerCase()
    );
  }
}
