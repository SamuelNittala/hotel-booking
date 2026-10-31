import { InvalidPropertyError } from './errors';

export type PropertyLocationProps = {
  city: string;
  locality: string;
  latitude: number;
  longitude: number;
};

/** Where a property is: the city and locality guests search by, plus its map coordinates. */
export class PropertyLocation {
  readonly city: string;
  readonly locality: string;
  readonly latitude: number;
  readonly longitude: number;

  private constructor(props: PropertyLocationProps) {
    this.city = props.city;
    this.locality = props.locality;
    this.latitude = props.latitude;
    this.longitude = props.longitude;
  }

  /** Validates the input and creates a location. City and locality are trimmed. */
  static of(props: PropertyLocationProps): PropertyLocation {
    const city = props.city.trim();
    const locality = props.locality.trim();
    if (city === '') {
      throw new InvalidPropertyError('city must not be empty');
    }
    if (locality === '') {
      throw new InvalidPropertyError('locality must not be empty');
    }
    if (!Number.isFinite(props.latitude) || props.latitude < -90 || props.latitude > 90) {
      throw new InvalidPropertyError(`latitude must be between -90 and 90 (got ${props.latitude})`);
    }
    if (!Number.isFinite(props.longitude) || props.longitude < -180 || props.longitude > 180) {
      throw new InvalidPropertyError(`longitude must be between -180 and 180 (got ${props.longitude})`);
    }
    return new PropertyLocation({ ...props, city, locality });
  }
}
