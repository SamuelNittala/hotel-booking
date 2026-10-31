import { Room } from '../../property/room';

/**
 * One condition about a single room. Search keeps a room only if every room filter matches that same room,
 * so a property is never accepted because different rooms each passed a different filter.
 */
export interface RoomFilter {
  matches(room: Room): boolean;
}
