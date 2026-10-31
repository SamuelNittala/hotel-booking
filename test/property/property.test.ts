import { describe, expect, it } from 'vitest';
import { DuplicateRoomError, InvalidPropertyError } from '../../src/property/errors';
import { Property, PropertyProps } from '../../src/property/property';
import { PropertyLocation } from '../../src/property/property-location';
import { Room } from '../../src/property/room';

const location = PropertyLocation.of({ city: 'Bengaluru', locality: 'Indiranagar', latitude: 12.9784, longitude: 77.6408 });
const room = (id: number, overrides: { capacity?: number; pricePerNight?: number } = {}) =>
  Room.create({ id, type: 'queen', capacity: 2, pricePerNight: 4000, ...overrides });

const props = (overrides: Partial<PropertyProps> = {}): PropertyProps => ({
  id: 1,
  name: 'Lakeview Inn',
  ownerId: 7,
  location,
  amenities: ['wifi', 'pool'],
  starRating: 4,
  ...overrides,
});

describe('Property.create', () => {
  it('creates a property from valid input with no rooms and a one night minimum', () => {
    const property = Property.create(props());

    expect(property.id).toBe(1);
    expect(property.name).toBe('Lakeview Inn');
    expect(property.ownerId).toBe(7);
    expect(property.location).toBe(location);
    expect(property.starRating).toBe(4);
    expect(property.minNights).toBe(1);
    expect(property.rooms).toEqual([]);
  });

  it('trims the name', () => {
    expect(Property.create(props({ name: '  Lakeview Inn ' })).name).toBe('Lakeview Inn');
  });

  it.each(['', '   '])('rejects an empty name %j', (name) => {
    expect(() => Property.create(props({ name }))).toThrow(InvalidPropertyError);
  });

  it.each([0, 6, 3.5, -1, Number.NaN])('rejects a star rating of %s', (starRating) => {
    expect(() => Property.create(props({ starRating }))).toThrow(InvalidPropertyError);
  });

  it.each([1, 5])('accepts a star rating of %s', (starRating) => {
    expect(() => Property.create(props({ starRating }))).not.toThrow();
  });

  it('keeps a given minimum number of nights', () => {
    expect(Property.create(props({ minNights: 2 })).minNights).toBe(2);
  });

  it.each([0, -1, 1.5, Number.NaN])('rejects a minimum of %s nights', (minNights) => {
    expect(() => Property.create(props({ minNights }))).toThrow(InvalidPropertyError);
  });

  it('adds the rooms it is given', () => {
    const property = Property.create(props({ rooms: [room(101), room(102)] }));

    expect(property.rooms.map((existing) => existing.id)).toEqual([101, 102]);
  });

  it('rejects two rooms with the same id', () => {
    expect(() => Property.create(props({ rooms: [room(101), room(101)] }))).toThrow(DuplicateRoomError);
  });
});

describe('Property amenities', () => {
  it('trims, lower-cases and removes duplicates', () => {
    const property = Property.create(props({ amenities: [' WiFi ', 'wifi', 'Pool'] }));

    expect([...property.amenities].sort()).toEqual(['pool', 'wifi']);
  });

  it('answers a lookup whatever the original case', () => {
    const property = Property.create(props({ amenities: ['WiFi'] }));

    expect(property.amenities.has('wifi')).toBe(true);
  });

  it('allows a property with no amenities', () => {
    expect(Property.create(props({ amenities: [] })).amenities.size).toBe(0);
  });

  it.each([[['wifi', '']], [['  ']]])('rejects an empty amenity name in %j', (amenities) => {
    expect(() => Property.create(props({ amenities }))).toThrow(InvalidPropertyError);
  });
});

describe('Property rooms', () => {
  it('adds a room to an existing property', () => {
    const property = Property.create(props());

    property.addRoom(room(101));

    expect(property.rooms).toHaveLength(1);
  });

  it('rejects a second room with the same id and keeps the first', () => {
    const property = Property.create(props({ rooms: [room(101, { pricePerNight: 4000 })] }));

    expect(() => property.addRoom(room(101, { pricePerNight: 9000 }))).toThrow(DuplicateRoomError);

    expect(property.rooms).toHaveLength(1);
    expect(property.findRoom(101)?.pricePerNight).toBe(4000);
  });

  it('finds a room by id', () => {
    const second = room(102);
    const property = Property.create(props({ rooms: [room(101), second] }));

    expect(property.findRoom(102)).toBe(second);
  });

  it('returns undefined for a room it does not have', () => {
    expect(Property.create(props({ rooms: [room(101)] })).findRoom(999)).toBeUndefined();
  });

  it('does not let the input list change its rooms afterwards', () => {
    const input = [room(101)];
    const property = Property.create(props({ rooms: input }));

    input.push(room(102));

    expect(property.rooms).toHaveLength(1);
  });
});
