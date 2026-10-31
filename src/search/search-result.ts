import { Property } from '../property/property';
import { Room } from '../property/room';

/** One room that can be booked for the searched dates, with what the whole stay would cost. */
export type RoomOffer = {
  room: Room;
  /** Nights in the searched range times the room's price per night. */
  totalPrice: number;
};

/** A property with at least one room that passed every filter and is free for the dates. */
export type SearchResult = {
  property: Property;
  rooms: readonly RoomOffer[];
};
