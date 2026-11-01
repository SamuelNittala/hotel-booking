import { Router } from 'express';
import { AddRoomRequest, PropertyService } from '../../property/property-service';
import { propertyJson, roomJson } from '../serializers';
import {
  asObject,
  optionalArray,
  optionalNumber,
  parseId,
  requireInteger,
  requireNumber,
  requireString,
  requireStringArray,
} from '../validation';

const parseRoom = (value: unknown, label: string): AddRoomRequest => {
  const body = asObject(value, label);
  return {
    type: requireString(body, 'type'),
    capacity: requireNumber(body, 'capacity'),
    pricePerNight: requireNumber(body, 'pricePerNight'),
  };
};

export function propertyRoutes(properties: PropertyService): Router {
  const router = Router();

  router.post('/properties', async (req, res) => {
    const body = asObject(req.body);
    const rooms = optionalArray(body, 'rooms')?.map((room, index) => parseRoom(room, `rooms[${index}]`));

    const property = await properties.addProperty({
      ownerId: requireInteger(body, 'ownerId'),
      name: requireString(body, 'name'),
      city: requireString(body, 'city'),
      locality: requireString(body, 'locality'),
      latitude: requireNumber(body, 'latitude'),
      longitude: requireNumber(body, 'longitude'),
      amenities: requireStringArray(body, 'amenities'),
      starRating: requireNumber(body, 'starRating'),
      minNights: optionalNumber(body, 'minNights'),
      rooms,
    });

    res.status(201).json(propertyJson(property));
  });

  router.post('/properties/:propertyId/rooms', async (req, res) => {
    const propertyId = parseId(req.params.propertyId, 'propertyId');

    const room = await properties.addRoom(propertyId, parseRoom(req.body, 'request body'));

    res.status(201).json(roomJson(room));
  });

  return router;
}
