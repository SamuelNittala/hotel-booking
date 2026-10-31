import { describe, expect, it } from 'vitest';
import { InvalidPropertyError } from '../../src/property/errors';
import { Room, RoomProps } from '../../src/property/room';

const props = (overrides: Partial<RoomProps> = {}): RoomProps => ({
  id: 101,
  type: 'queen',
  capacity: 3,
  pricePerNight: 4500,
  ...overrides,
});

describe('Room.create', () => {
  it('creates a room from valid input', () => {
    const room = Room.create(props());

    expect(room.id).toBe(101);
    expect(room.type).toBe('queen');
    expect(room.capacity).toBe(3);
    expect(room.pricePerNight).toBe(4500);
  });

  it('trims the room type', () => {
    expect(Room.create(props({ type: '  queen ' })).type).toBe('queen');
  });

  it.each(['', '   '])('rejects an empty type %j', (type) => {
    expect(() => Room.create(props({ type }))).toThrow(InvalidPropertyError);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects a capacity of %s', (capacity) => {
    expect(() => Room.create(props({ capacity }))).toThrow(InvalidPropertyError);
  });

  it.each([0, -100, Number.NaN, Number.POSITIVE_INFINITY])('rejects a price of %s', (pricePerNight) => {
    expect(() => Room.create(props({ pricePerNight }))).toThrow(InvalidPropertyError);
  });
});

describe('Room.canHost', () => {
  const room = Room.create(props({ capacity: 3 }));

  it.each([1, 2, 3])('fits %s guests in a room for 3', (guestCount) => {
    expect(room.canHost(guestCount)).toBe(true);
  });

  it.each([4, 10])('does not fit %s guests in a room for 3', (guestCount) => {
    expect(room.canHost(guestCount)).toBe(false);
  });

  it.each([0, -1, 1.5, Number.NaN])('does not accept a guest count of %s', (guestCount) => {
    expect(room.canHost(guestCount)).toBe(false);
  });
});
