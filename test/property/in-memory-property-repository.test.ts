import { beforeEach, describe, expect, it } from 'vitest';
import { RoomIdAlreadyUsedError } from '../../src/property/errors';
import { InMemoryPropertyRepository } from '../../src/property/in-memory-property-repository';
import { Property } from '../../src/property/property';
import { PropertyLocation } from '../../src/property/property-location';
import { Room } from '../../src/property/room';

const room = (id: number) => Room.create({ id, type: 'queen', capacity: 2, pricePerNight: 4000 });

const property = (
  id: number,
  overrides: { ownerId?: number; city?: string; roomIds?: number[] } = {},
): Property =>
  Property.create({
    id,
    name: `Property ${id}`,
    ownerId: overrides.ownerId ?? 1,
    location: PropertyLocation.of({
      city: overrides.city ?? 'Bengaluru',
      locality: 'Indiranagar',
      latitude: 12.97,
      longitude: 77.64,
    }),
    amenities: ['wifi'],
    starRating: 4,
    rooms: (overrides.roomIds ?? []).map(room),
  });

const ids = (properties: readonly Property[]) => properties.map((found) => found.id).sort((a, b) => a - b);

describe('InMemoryPropertyRepository', () => {
  let repository: InMemoryPropertyRepository;

  beforeEach(() => {
    repository = new InMemoryPropertyRepository();
  });

  describe('save and findById', () => {
    it('returns a saved property with its rooms', async () => {
      const saved = property(1, { roomIds: [101, 102] });
      await repository.save(saved);

      const found = await repository.findById(1);

      expect(found).toBe(saved);
      expect(found?.rooms.map((existing) => existing.id)).toEqual([101, 102]);
    });

    it('returns undefined for an unknown id', async () => {
      expect(await repository.findById(999)).toBeUndefined();
    });

    it('replaces the stored property when saved again with the same id', async () => {
      const saved = property(1, { roomIds: [101] });
      await repository.save(saved);

      saved.addRoom(room(102));
      await repository.save(saved);

      expect((await repository.findById(1))?.rooms).toHaveLength(2);
    });

    it('keeps other properties when one is saved again', async () => {
      await repository.save(property(1));
      await repository.save(property(2));

      await repository.save(property(1));

      expect(await repository.findById(2)).toBeDefined();
    });
  });

  describe('room ids across properties', () => {
    it('rejects a property whose room id belongs to a different property', async () => {
      await repository.save(property(1, { roomIds: [101] }));

      await expect(repository.save(property(2, { roomIds: [101] }))).rejects.toThrow(RoomIdAlreadyUsedError);
    });

    it('stores nothing for a rejected property', async () => {
      await repository.save(property(1, { roomIds: [101] }));

      await repository.save(property(2, { roomIds: [201, 101] })).catch(() => undefined);

      expect(await repository.findById(2)).toBeUndefined();
      await expect(repository.save(property(3, { roomIds: [201] }))).resolves.toBeUndefined();
    });

    it('lets a property be saved again with the room ids it already has', async () => {
      await repository.save(property(1, { roomIds: [101, 102] }));

      await expect(repository.save(property(1, { roomIds: [101, 102] }))).resolves.toBeUndefined();
    });

    it('lets different properties use different room ids', async () => {
      await repository.save(property(1, { roomIds: [101] }));

      await expect(repository.save(property(2, { roomIds: [201] }))).resolves.toBeUndefined();
    });
  });

  describe('findByOwnerId', () => {
    it('returns all properties of one owner and no others', async () => {
      await repository.save(property(1, { ownerId: 7 }));
      await repository.save(property(2, { ownerId: 7 }));
      await repository.save(property(3, { ownerId: 8 }));

      expect(ids(await repository.findByOwnerId(7))).toEqual([1, 2]);
    });

    it('returns an empty list for an owner with no properties', async () => {
      expect(await repository.findByOwnerId(7)).toEqual([]);
    });
  });

  describe('findByCity', () => {
    it('returns the properties in a city', async () => {
      await repository.save(property(1, { city: 'Bengaluru' }));
      await repository.save(property(2, { city: 'Mumbai' }));
      await repository.save(property(3, { city: 'Bengaluru' }));

      expect(ids(await repository.findByCity('Bengaluru'))).toEqual([1, 3]);
    });

    it('ignores case and surrounding spaces', async () => {
      await repository.save(property(1, { city: 'Bengaluru' }));

      expect(ids(await repository.findByCity('  bengaluru '))).toEqual([1]);
    });

    it('returns an empty list for a city with no properties', async () => {
      await repository.save(property(1, { city: 'Bengaluru' }));

      expect(await repository.findByCity('Delhi')).toEqual([]);
    });
  });
});
