import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryPropertyRepository } from '../../src/property/in-memory-property-repository';
import { InvalidPropertyError, PropertyNotFoundError, RoomIdAlreadyUsedError } from '../../src/property/errors';
import { AddPropertyRequest, PropertyService } from '../../src/property/property-service';
import { SequentialIdGenerator } from '../../src/shared/sequential-id-generator';

const request = (overrides: Partial<AddPropertyRequest> = {}): AddPropertyRequest => ({
  ownerId: 7,
  name: 'Lakeview Inn',
  city: 'Bengaluru',
  locality: 'Indiranagar',
  latitude: 12.97,
  longitude: 77.64,
  amenities: ['WiFi', ' pool '],
  starRating: 4,
  ...overrides,
});

const roomRequest = { type: 'queen', capacity: 2, pricePerNight: 4000 };

describe('PropertyService', () => {
  let repository: InMemoryPropertyRepository;
  let service: PropertyService;

  beforeEach(() => {
    repository = new InMemoryPropertyRepository();
    service = new PropertyService(repository, new SequentialIdGenerator());
  });

  describe('addProperty', () => {
    it('saves the property so it can be found again', async () => {
      const property = await service.addProperty(request());

      expect(await repository.findById(property.id)).toBe(property);
    });

    it('builds the property from the request', async () => {
      const property = await service.addProperty(request({ minNights: 2 }));

      expect(property.name).toBe('Lakeview Inn');
      expect(property.ownerId).toBe(7);
      expect(property.location.city).toBe('Bengaluru');
      expect(property.location.locality).toBe('Indiranagar');
      expect(property.starRating).toBe(4);
      expect(property.minNights).toBe(2);
      expect([...property.amenities].sort()).toEqual(['pool', 'wifi']);
    });

    it('defaults to a one night minimum stay', async () => {
      const property = await service.addProperty(request());

      expect(property.minNights).toBe(1);
    });

    it('creates a property with no rooms when none are given', async () => {
      const property = await service.addProperty(request());

      expect(property.rooms).toEqual([]);
    });

    it('creates the rooms in the request, each with its own id', async () => {
      const property = await service.addProperty(
        request({ rooms: [roomRequest, { ...roomRequest, type: 'suite', capacity: 4, pricePerNight: 9000 }] }),
      );

      expect(property.rooms.map((room) => room.type)).toEqual(['queen', 'suite']);
      const roomIds = property.rooms.map((room) => room.id);
      expect(new Set(roomIds).size).toBe(2);
      expect(roomIds).not.toContain(property.id);
    });

    it('lets one owner add several properties', async () => {
      await service.addProperty(request({ name: 'First' }));
      await service.addProperty(request({ name: 'Second' }));

      expect(await repository.findByOwnerId(7)).toHaveLength(2);
    });

    it('never gives the same room id to rooms in different properties', async () => {
      const first = await service.addProperty(request({ rooms: [roomRequest, roomRequest] }));
      const second = await service.addProperty(request({ rooms: [roomRequest, roomRequest] }));

      const roomIds = [...first.rooms, ...second.rooms].map((room) => room.id);
      expect(new Set(roomIds).size).toBe(4);
    });

    it('saves nothing when the property is invalid', async () => {
      await expect(service.addProperty(request({ starRating: 9 }))).rejects.toThrow(InvalidPropertyError);

      expect(await repository.findByOwnerId(7)).toEqual([]);
    });

    it('saves nothing when one of the rooms is invalid', async () => {
      await expect(
        service.addProperty(request({ rooms: [roomRequest, { ...roomRequest, capacity: 0 }] })),
      ).rejects.toThrow(InvalidPropertyError);

      expect(await repository.findByOwnerId(7)).toEqual([]);
    });

    it('fails when the repository cannot save, instead of returning a property that was not stored', async () => {
      vi.spyOn(repository, 'save').mockRejectedValue(new RoomIdAlreadyUsedError(1, 2));

      await expect(service.addProperty(request())).rejects.toThrow(RoomIdAlreadyUsedError);
    });
  });

  describe('addRoom', () => {
    it('adds the room to the property and returns it', async () => {
      const property = await service.addProperty(request());

      const room = await service.addRoom(property.id, roomRequest);

      expect(room.type).toBe('queen');
      expect(room.capacity).toBe(2);
      expect(room.pricePerNight).toBe(4000);
      expect((await repository.findById(property.id))?.findRoom(room.id)).toBe(room);
    });

    it('saves the property after adding the room', async () => {
      const property = await service.addProperty(request());
      const save = vi.spyOn(repository, 'save');

      await service.addRoom(property.id, roomRequest);

      expect(save).toHaveBeenCalledTimes(1);
      expect(save).toHaveBeenCalledWith(property);
    });

    it('keeps the rooms the property already had', async () => {
      const property = await service.addProperty(request({ rooms: [roomRequest] }));
      const existingId = property.rooms[0]!.id;

      const room = await service.addRoom(property.id, roomRequest);

      expect(room.id).not.toBe(existingId);
      expect(property.rooms.map((existing) => existing.id)).toEqual([existingId, room.id]);
    });

    it('gives each new room its own id', async () => {
      const property = await service.addProperty(request());

      const first = await service.addRoom(property.id, roomRequest);
      const second = await service.addRoom(property.id, roomRequest);

      expect(first.id).not.toBe(second.id);
    });

    it('throws when the property does not exist', async () => {
      await expect(service.addRoom(999, roomRequest)).rejects.toThrow(PropertyNotFoundError);
    });

    it('adds nothing when the room is invalid', async () => {
      const property = await service.addProperty(request());

      await expect(service.addRoom(property.id, { ...roomRequest, pricePerNight: 0 })).rejects.toThrow(
        InvalidPropertyError,
      );

      expect(property.rooms).toEqual([]);
    });

    it('fails when the repository cannot save', async () => {
      const property = await service.addProperty(request());
      vi.spyOn(repository, 'save').mockRejectedValue(new RoomIdAlreadyUsedError(1, 2));

      await expect(service.addRoom(property.id, roomRequest)).rejects.toThrow(RoomIdAlreadyUsedError);
    });
  });
});
