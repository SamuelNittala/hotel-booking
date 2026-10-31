import { Property } from './property';

/**
 * Stores properties together with their rooms, as one unit.
 * Lookups that find nothing return `undefined` or an empty list, they do not throw.
 */
export interface PropertyRepository {
  /**
   * Inserts the property, or replaces the stored one with the same id.
   * Throws `RoomIdAlreadyUsedError` if one of its rooms has an id that belongs to a different property.
   * Always call it after changing a property, so a database-backed version behaves the same way.
   */
  save(property: Property): Promise<void>;
  findById(id: number): Promise<Property | undefined>;
  findByOwnerId(ownerId: number): Promise<readonly Property[]>;
  /** Matches the city ignoring case and surrounding spaces. */
  findByCity(city: string): Promise<readonly Property[]>;
}
