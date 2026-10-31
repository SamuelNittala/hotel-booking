import { describe, expect, it } from 'vitest';
import { Property } from '../../../src/property/property';
import { PropertyLocation } from '../../../src/property/property-location';
import { AmenitiesFilter } from '../../../src/search/filters/amenities-filter';
import { LocalityFilter } from '../../../src/search/filters/locality-filter';
import { MinNightsFilter } from '../../../src/search/filters/min-nights-filter';
import { StarRatingFilter } from '../../../src/search/filters/star-rating-filter';
import { DateRange } from '../../../src/shared/date-range';

const property = (
  overrides: { locality?: string; starRating?: number; amenities?: string[]; minNights?: number } = {},
): Property =>
  Property.create({
    id: 1,
    name: 'Lakeview Inn',
    ownerId: 7,
    location: PropertyLocation.of({
      city: 'Bengaluru',
      locality: overrides.locality ?? 'Indiranagar',
      latitude: 12.97,
      longitude: 77.64,
    }),
    amenities: overrides.amenities ?? ['wifi', 'pool'],
    starRating: overrides.starRating ?? 4,
    minNights: overrides.minNights,
  });

describe('LocalityFilter', () => {
  it('matches the same locality', () => {
    expect(new LocalityFilter('Indiranagar').matches(property())).toBe(true);
  });

  it('ignores case and surrounding spaces', () => {
    expect(new LocalityFilter('  indiranagar ').matches(property())).toBe(true);
  });

  it('does not match a different locality', () => {
    expect(new LocalityFilter('Koramangala').matches(property())).toBe(false);
  });
});

describe('StarRatingFilter', () => {
  it('matches a rating equal to the minimum', () => {
    expect(new StarRatingFilter(4).matches(property({ starRating: 4 }))).toBe(true);
  });

  it('matches a rating above the minimum', () => {
    expect(new StarRatingFilter(3).matches(property({ starRating: 5 }))).toBe(true);
  });

  it('does not match a rating below the minimum', () => {
    expect(new StarRatingFilter(4).matches(property({ starRating: 3 }))).toBe(false);
  });
});

describe('AmenitiesFilter', () => {
  it('matches when the property has every wanted amenity', () => {
    expect(new AmenitiesFilter(['wifi', 'pool']).matches(property())).toBe(true);
  });

  it('matches when the property has more than the wanted amenities', () => {
    expect(new AmenitiesFilter(['wifi']).matches(property())).toBe(true);
  });

  it('does not match when one wanted amenity is missing', () => {
    expect(new AmenitiesFilter(['wifi', 'gym']).matches(property())).toBe(false);
  });

  it('ignores case and surrounding spaces in the wanted names', () => {
    expect(new AmenitiesFilter(['WiFi', ' pool ']).matches(property())).toBe(true);
  });

  it('matches every property when nothing is wanted', () => {
    expect(new AmenitiesFilter([]).matches(property({ amenities: [] }))).toBe(true);
  });
});

describe('MinNightsFilter', () => {
  it('matches a stay equal to the minimum', () => {
    const stay = DateRange.of('2026-11-01', '2026-11-03');

    expect(new MinNightsFilter(stay).matches(property({ minNights: 2 }))).toBe(true);
  });

  it('matches a stay longer than the minimum', () => {
    const stay = DateRange.of('2026-11-01', '2026-11-05');

    expect(new MinNightsFilter(stay).matches(property({ minNights: 2 }))).toBe(true);
  });

  it('does not match a stay shorter than the minimum', () => {
    const stay = DateRange.of('2026-11-01', '2026-11-02');

    expect(new MinNightsFilter(stay).matches(property({ minNights: 2 }))).toBe(false);
  });

  it('accepts a one night stay at a property with the default minimum', () => {
    const stay = DateRange.of('2026-11-01', '2026-11-02');

    expect(new MinNightsFilter(stay).matches(property())).toBe(true);
  });
});
