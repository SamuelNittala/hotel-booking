import { DuplicateRoomError, InvalidPropertyError } from './errors';
import { PropertyLocation } from './property-location';
import { Room } from './room';

export type PropertyProps = {
  id: number;
  name: string;
  /** The owner or chain account that manages this property. One owner can have many properties. */
  ownerId: number;
  location: PropertyLocation;
  /** Names such as 'wifi' or 'pool'. Trimmed, lower-cased and de-duplicated. */
  amenities: readonly string[];
  /** 1 to 5, set by the owner. */
  starRating: number;
  /** Shortest stay the property accepts. Defaults to 1. */
  minNights?: number;
  rooms?: readonly Room[];
};

/**
 * A property that guests can book, and the rooms it owns. All access to its rooms goes through
 * the property, so it can keep its own rules (for example, no two rooms with the same id).
 */
export class Property {
  readonly id: number;
  readonly name: string;
  readonly ownerId: number;
  readonly location: PropertyLocation;
  readonly amenities: ReadonlySet<string>;
  readonly starRating: number;
  readonly minNights: number;

  private readonly roomList: Room[] = [];

  private constructor(props: PropertyProps, name: string, amenities: ReadonlySet<string>, minNights: number) {
    this.id = props.id;
    this.name = name;
    this.ownerId = props.ownerId;
    this.location = props.location;
    this.amenities = amenities;
    this.starRating = props.starRating;
    this.minNights = minNights;
  }

  /** Validates the input and creates a property, adding any rooms given. */
  static create(props: PropertyProps): Property {
    const name = props.name.trim();
    if (name === '') {
      throw new InvalidPropertyError('name must not be empty');
    }
    if (!Number.isInteger(props.starRating) || props.starRating < 1 || props.starRating > 5) {
      throw new InvalidPropertyError(`starRating must be a whole number from 1 to 5 (got ${props.starRating})`);
    }
    const minNights = props.minNights ?? 1;
    if (!Number.isInteger(minNights) || minNights < 1) {
      throw new InvalidPropertyError(`minNights must be a whole number of at least 1 (got ${minNights})`);
    }

    const property = new Property(props, name, Property.normaliseAmenities(props.amenities), minNights);
    (props.rooms ?? []).forEach((room) => property.addRoom(room));
    return property;
  }

  get rooms(): readonly Room[] {
    return this.roomList;
  }

  /** Adds a room. Throws `DuplicateRoomError` if this property already has a room with the same id. */
  addRoom(room: Room): void {
    if (this.findRoom(room.id)) {
      throw new DuplicateRoomError(this.id, room.id);
    }
    this.roomList.push(room);
  }

  findRoom(roomId: number): Room | undefined {
    return this.roomList.find((room) => room.id === roomId);
  }

  private static normaliseAmenities(amenities: readonly string[]): ReadonlySet<string> {
    const normalised = amenities.map((amenity) => amenity.trim().toLowerCase());
    if (normalised.some((amenity) => amenity === '')) {
      throw new InvalidPropertyError('amenities must not contain an empty name');
    }
    return new Set(normalised);
  }
}
