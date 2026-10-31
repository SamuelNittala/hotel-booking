import { describe, expect, it } from 'vitest';
import { Room } from '../../../src/property/room';
import { GuestCountFilter } from '../../../src/search/filters/guest-count-filter';
import { PriceRangeFilter } from '../../../src/search/filters/price-range-filter';
import { RoomTypeFilter } from '../../../src/search/filters/room-type-filter';

const room = (overrides: { type?: string; capacity?: number; pricePerNight?: number } = {}): Room =>
  Room.create({
    id: 1,
    type: overrides.type ?? 'queen',
    capacity: overrides.capacity ?? 2,
    pricePerNight: overrides.pricePerNight ?? 4000,
  });

describe('GuestCountFilter', () => {
  it('matches when the guests fit exactly', () => {
    expect(new GuestCountFilter(2).matches(room({ capacity: 2 }))).toBe(true);
  });

  it('matches when the room is bigger than needed', () => {
    expect(new GuestCountFilter(1).matches(room({ capacity: 4 }))).toBe(true);
  });

  it('does not match when there are more guests than the room holds', () => {
    expect(new GuestCountFilter(3).matches(room({ capacity: 2 }))).toBe(false);
  });

  it('does not match zero guests', () => {
    expect(new GuestCountFilter(0).matches(room())).toBe(false);
  });
});

describe('PriceRangeFilter', () => {
  it('matches a price inside the range', () => {
    expect(new PriceRangeFilter(2000, 5000).matches(room({ pricePerNight: 4000 }))).toBe(true);
  });

  it('includes both ends of the range', () => {
    const filter = new PriceRangeFilter(2000, 5000);

    expect(filter.matches(room({ pricePerNight: 2000 }))).toBe(true);
    expect(filter.matches(room({ pricePerNight: 5000 }))).toBe(true);
  });

  it('does not match a price below the range', () => {
    expect(new PriceRangeFilter(2000, 5000).matches(room({ pricePerNight: 1999 }))).toBe(false);
  });

  it('does not match a price above the range', () => {
    expect(new PriceRangeFilter(2000, 5000).matches(room({ pricePerNight: 5001 }))).toBe(false);
  });

  it('applies only the minimum when no maximum is given', () => {
    const filter = new PriceRangeFilter(3000, undefined);

    expect(filter.matches(room({ pricePerNight: 9000 }))).toBe(true);
    expect(filter.matches(room({ pricePerNight: 2999 }))).toBe(false);
  });

  it('applies only the maximum when no minimum is given', () => {
    const filter = new PriceRangeFilter(undefined, 3000);

    expect(filter.matches(room({ pricePerNight: 1000 }))).toBe(true);
    expect(filter.matches(room({ pricePerNight: 3001 }))).toBe(false);
  });

  it('matches every room when neither end is given', () => {
    expect(new PriceRangeFilter(undefined, undefined).matches(room({ pricePerNight: 123456 }))).toBe(true);
  });

  it('treats a minimum of zero as a real minimum', () => {
    expect(new PriceRangeFilter(0, 5000).matches(room({ pricePerNight: 4000 }))).toBe(true);
  });
});

describe('RoomTypeFilter', () => {
  it('matches the same type', () => {
    expect(new RoomTypeFilter('queen').matches(room({ type: 'queen' }))).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    expect(new RoomTypeFilter('  QUEEN ').matches(room({ type: 'queen' }))).toBe(true);
  });

  it('does not match a different type', () => {
    expect(new RoomTypeFilter('suite').matches(room({ type: 'queen' }))).toBe(false);
  });
});
