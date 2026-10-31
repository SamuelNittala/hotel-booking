import { RoomIdAlreadyUsedError } from './errors';
import { Property } from './property';
import { PropertyRepository } from './property-repository';

/** Keeps the property objects themselves in a map. */
export class InMemoryPropertyRepository implements PropertyRepository {
  private readonly propertiesById = new Map<number, Property>();
  private readonly propertyIdByRoomId = new Map<number, number>();

  async save(property: Property): Promise<void> {
    // Check every room before changing anything, so a rejected save leaves nothing behind.
    for (const room of property.rooms) {
      const owningPropertyId = this.propertyIdByRoomId.get(room.id);
      if (owningPropertyId !== undefined && owningPropertyId !== property.id) {
        throw new RoomIdAlreadyUsedError(room.id, owningPropertyId);
      }
    }
    this.propertiesById.set(property.id, property);
    property.rooms.forEach((room) => this.propertyIdByRoomId.set(room.id, property.id));
  }

  async findById(id: number): Promise<Property | undefined> {
    return this.propertiesById.get(id);
  }

  async findByOwnerId(ownerId: number): Promise<readonly Property[]> {
    return [...this.propertiesById.values()].filter((property) => property.ownerId === ownerId);
  }

  async findByCity(city: string): Promise<readonly Property[]> {
    const wanted = city.trim().toLowerCase();
    return [...this.propertiesById.values()].filter((property) => property.location.city.toLowerCase() === wanted);
  }
}
