import { Room } from '../../property/room';
import { RoomFilter } from './room-filter';

/** Matches rooms that can hold `guestCount` guests. */
export class GuestCountFilter implements RoomFilter {
  constructor(private readonly guestCount: number) {}

  matches(room: Room): boolean {
    return room.canHost(this.guestCount);
  }
}
