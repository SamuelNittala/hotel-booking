import { describe, expect, it } from 'vitest';
import { InvalidPropertyError } from '../../src/property/errors';
import { PropertyLocation, PropertyLocationProps } from '../../src/property/property-location';

const props = (overrides: Partial<PropertyLocationProps> = {}): PropertyLocationProps => ({
  city: 'Bengaluru',
  locality: 'Indiranagar',
  latitude: 12.9784,
  longitude: 77.6408,
  ...overrides,
});

describe('PropertyLocation.of', () => {
  it('creates a location from valid input', () => {
    const location = PropertyLocation.of(props());

    expect(location.city).toBe('Bengaluru');
    expect(location.locality).toBe('Indiranagar');
    expect(location.latitude).toBe(12.9784);
    expect(location.longitude).toBe(77.6408);
  });

  it('trims the city and locality', () => {
    const location = PropertyLocation.of(props({ city: '  Bengaluru ', locality: ' Indiranagar  ' }));

    expect(location.city).toBe('Bengaluru');
    expect(location.locality).toBe('Indiranagar');
  });

  it.each(['', '   '])('rejects an empty city %j', (city) => {
    expect(() => PropertyLocation.of(props({ city }))).toThrow(InvalidPropertyError);
  });

  it.each(['', '   '])('rejects an empty locality %j', (locality) => {
    expect(() => PropertyLocation.of(props({ locality }))).toThrow(InvalidPropertyError);
  });

  it.each([-90.01, 90.01, Number.NaN, Number.POSITIVE_INFINITY])('rejects a latitude of %s', (latitude) => {
    expect(() => PropertyLocation.of(props({ latitude }))).toThrow(InvalidPropertyError);
  });

  it.each([-180.01, 180.01, Number.NaN, Number.NEGATIVE_INFINITY])('rejects a longitude of %s', (longitude) => {
    expect(() => PropertyLocation.of(props({ longitude }))).toThrow(InvalidPropertyError);
  });

  it('accepts coordinates exactly on the limits', () => {
    expect(() => PropertyLocation.of(props({ latitude: 90, longitude: 180 }))).not.toThrow();
    expect(() => PropertyLocation.of(props({ latitude: -90, longitude: -180 }))).not.toThrow();
  });
});
