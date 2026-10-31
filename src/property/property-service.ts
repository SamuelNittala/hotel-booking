import { IdGenerator } from "../shared/id-generator";
import { PropertyNotFoundError } from "./errors";
import { Property } from "./property";
import { PropertyLocation } from "./property-location";
import { PropertyRepository } from "./property-repository";
import { Room } from "./room";

export type AddRoomRequest = {
  type: string;
  capacity: number;
  pricePerNight: number;
};

export type AddPropertyRequest = {
  /** The owner or chain account. A single-property owner is simply an owner who adds one property. */
  ownerId: number;
  name: string;
  city: string;
  locality: string;
  latitude: number;
  longitude: number;
  amenities: readonly string[];
  starRating: number;
  minNights?: number;
  /** Rooms to create together with the property. More can be added later with `addRoom`. */
  rooms?: readonly AddRoomRequest[];
};

/** Onboarding: creates properties and rooms from plain request data and saves them. */
export class PropertyService {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly ids: IdGenerator,
  ) {}

  /** Creates a property (and any rooms in the request), saves it and returns it. */
  async addProperty(request: AddPropertyRequest): Promise<Property> {
    const location = PropertyLocation.of({
      locality: request.locality,
      latitude: request.latitude,
      longitude: request.longitude,
      city: request.city,
    });
    const validatedRooms = (request.rooms ?? []).map((room) =>
      Room.create({ ...room, id: this.ids.next() }),
    );
    const newProperty = Property.create({
      id: this.ids.next(),
      name: request.name,
      location,
      ownerId: request.ownerId,
      amenities: request.amenities,
      starRating: request.starRating,
      minNights: request.minNights,
      rooms: validatedRooms,
    });
    await this.properties.save(newProperty);
    return newProperty;
  }

  /**
   * Adds one room to an existing property, saves the property and returns the new room.
   * Throws `PropertyNotFoundError` if the property does not exist.
   */
  async addRoom(propertyId: number, request: AddRoomRequest): Promise<Room> {
    const property = await this.properties.findById(propertyId);
    if (!property) {
      throw new PropertyNotFoundError(propertyId)
    }
    const newRoom = Room.create({...request, id: this.ids.next()})
    property.addRoom(newRoom);
    await this.properties.save(property);
    return newRoom;
  }
}
