import { InvalidPropertyError } from './errors';

export type RoomProps = {
  /** Unique across all properties, because availability and bookings identify a room by this id alone. */
  id: number;
  /** The kind of room, e.g. 'single' or 'queen'. A plain string so new kinds need no code change. */
  type: string;
  /** The most guests the room takes. */
  capacity: number;
  pricePerNight: number;
};

/** One physical room in a property. */
export class Room {
  readonly id: number;
  readonly type: string;
  readonly capacity: number;
  readonly pricePerNight: number;

  private constructor(props: RoomProps) {
    this.id = props.id;
    this.type = props.type;
    this.capacity = props.capacity;
    this.pricePerNight = props.pricePerNight;
  }

  static create(props: RoomProps): Room {
    const type = props.type.trim();
    if (type === '') {
      throw new InvalidPropertyError('room type must not be empty');
    }
    if (!Number.isInteger(props.capacity) || props.capacity < 1) {
      throw new InvalidPropertyError(`room capacity must be a whole number of at least 1 (got ${props.capacity})`);
    }
    if (!Number.isFinite(props.pricePerNight) || props.pricePerNight <= 0) {
      throw new InvalidPropertyError(`pricePerNight must be more than zero (got ${props.pricePerNight})`);
    }
    return new Room({ ...props, type });
  }

  /** True if `guestCount` guests fit in this room. */
  canHost(guestCount: number): boolean {
    return Number.isInteger(guestCount) && guestCount >= 1 && guestCount <= this.capacity;
  }
}
