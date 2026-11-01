import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { startTestServer, TestServer } from '../support/test-server';

const room = (overrides: Record<string, unknown> = {}) => ({
  type: 'queen',
  capacity: 2,
  pricePerNight: 4000,
  ...overrides,
});

const propertyBody = (overrides: Record<string, unknown> = {}) => ({
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

const searchPath = (params: Record<string, string> = {}) => {
  const query = new URLSearchParams({
    city: 'Bengaluru',
    fromDate: '2026-11-10',
    toDate: '2026-11-12',
    guests: '2',
    ...params,
  });
  return `/properties/search?${query}`;
};

describe('REST API: properties and search', () => {
  let server: TestServer;

  beforeEach(async () => {
    server = await startTestServer({ now: () => new Date('2026-11-01T10:00:00Z') });
  });

  afterEach(async () => {
    await server.close();
  });

  const addProperty = async (overrides: Record<string, unknown> = {}) => {
    const response = await server.call('POST', '/properties', propertyBody(overrides));
    expect(response.status).toBe(201);
    return response.body;
  };

  const foundIds = (response: { body: any }): number[] =>
    response.body.results.map((result: any) => result.property.id).sort();

  describe('POST /properties', () => {
    it('creates the property with its rooms and returns it', async () => {
      const response = await server.call(
        'POST',
        '/properties',
        propertyBody({ minNights: 2, rooms: [room(), room({ type: 'suite', capacity: 4, pricePerNight: 9000 })] }),
      );

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Lakeview Inn',
        ownerId: 7,
        location: { city: 'Bengaluru', locality: 'Indiranagar', latitude: 12.97, longitude: 77.64 },
        starRating: 4,
        minNights: 2,
      });
      expect(response.body.id).toEqual(expect.any(Number));
      expect(response.body.rooms.map((r: any) => r.type)).toEqual(['queen', 'suite']);
      expect(response.body.rooms[0]).toMatchObject({ capacity: 2, pricePerNight: 4000 });
    });

    it('returns amenities cleaned up and sorted', async () => {
      const property = await addProperty();

      expect(property.amenities).toEqual(['pool', 'wifi']);
    });

    it('creates a property with no rooms and a one night minimum when they are left out', async () => {
      const property = await addProperty();

      expect(property.rooms).toEqual([]);
      expect(property.minNights).toBe(1);
    });

    it('lets one owner add several properties, each with its own rooms', async () => {
      const first = await addProperty({ name: 'First', rooms: [room()] });
      const second = await addProperty({ name: 'Second', rooms: [room()] });

      expect(first.id).not.toBe(second.id);
      expect(first.rooms[0].id).not.toBe(second.rooms[0].id);
    });

    it.each(['ownerId', 'name', 'city', 'locality', 'latitude', 'longitude', 'amenities', 'starRating'])(
      'rejects a request without %s',
      async (field) => {
        const body: Record<string, unknown> = propertyBody();
        delete body[field];

        const response = await server.call('POST', '/properties', body);

        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('BadRequestError');
        expect(response.body.error.message).toContain(field);
      },
    );

    it('rejects values of the wrong type', async () => {
      const response = await server.call('POST', '/properties', propertyBody({ starRating: 'five' }));

      expect(response.status).toBe(400);
    });

    it('rejects a star rating the domain does not allow', async () => {
      const response = await server.call('POST', '/properties', propertyBody({ starRating: 9 }));

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('InvalidPropertyError');
    });

    it('rejects an invalid room and creates nothing', async () => {
      const response = await server.call('POST', '/properties', propertyBody({ rooms: [room(), room({ capacity: 0 })] }));

      expect(response.status).toBe(400);
      expect((await server.call('GET', searchPath())).body.results).toEqual([]);
    });

    it('names the room that is malformed', async () => {
      const response = await server.call('POST', '/properties', propertyBody({ rooms: [room(), 'oops'] }));

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('rooms[1]');
    });

    it('rejects a body that is not a JSON object', async () => {
      const response = await server.call('POST', '/properties', ['not', 'an', 'object']);

      expect(response.status).toBe(400);
    });

    it('rejects a body that is not valid JSON', async () => {
      const response = await server.callRaw('POST', '/properties', '{oops');

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Request body is not valid JSON');
    });
  });

  describe('POST /properties/:propertyId/rooms', () => {
    it('adds a room to an existing property', async () => {
      const property = await addProperty();

      const response = await server.call('POST', `/properties/${property.id}/rooms`, room({ type: 'suite' }));

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ type: 'suite', capacity: 2, pricePerNight: 4000 });
      expect(response.body.id).toEqual(expect.any(Number));
    });

    it('makes the new room appear in search', async () => {
      const property = await addProperty();
      await server.call('POST', `/properties/${property.id}/rooms`, room());

      const response = await server.call('GET', searchPath());

      expect(foundIds(response)).toEqual([property.id]);
    });

    it('answers 404 for a property that does not exist', async () => {
      const response = await server.call('POST', '/properties/999/rooms', room());

      expect(response.status).toBe(404);
      expect(response.body.error.type).toBe('PropertyNotFoundError');
    });

    it.each(['abc', '0', '-1', '1.5'])('answers 400 for the property id %s', async (id) => {
      const response = await server.call('POST', `/properties/${id}/rooms`, room());

      expect(response.status).toBe(400);
    });

    it('rejects an invalid room', async () => {
      const property = await addProperty();

      const response = await server.call('POST', `/properties/${property.id}/rooms`, room({ pricePerNight: 0 }));

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('InvalidPropertyError');
    });
  });

  describe('GET /properties/search', () => {
    it('returns matching properties with only the rooms that fit, priced for the whole stay', async () => {
      const property = await addProperty({
        rooms: [room({ capacity: 2 }), room({ type: 'suite', capacity: 4, pricePerNight: 9000 })],
      });

      const response = await server.call('GET', searchPath({ guests: '3' }));

      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].property.id).toBe(property.id);
      expect(response.body.results[0].property.rooms).toBeUndefined();
      expect(response.body.results[0].rooms).toHaveLength(1);
      expect(response.body.results[0].rooms[0]).toMatchObject({ type: 'suite', pricePerNight: 9000, totalPrice: 18000 });
    });

    it('returns an empty list when nothing matches', async () => {
      await addProperty({ rooms: [room()] });

      const response = await server.call('GET', searchPath({ city: 'Mumbai' }));

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ results: [] });
    });

    it('ignores case in the city', async () => {
      const property = await addProperty({ rooms: [room()] });

      expect(foundIds(await server.call('GET', searchPath({ city: 'bENGALURU' })))).toEqual([property.id]);
    });

    describe('filters', () => {
      it('by price range', async () => {
        const cheap = await addProperty({ name: 'Cheap', rooms: [room({ pricePerNight: 2000 })] });
        await addProperty({ name: 'Dear', rooms: [room({ pricePerNight: 9000 })] });

        expect(foundIds(await server.call('GET', searchPath({ minPrice: '1000', maxPrice: '3000' })))).toEqual([cheap.id]);
      });

      it('by a minimum price alone', async () => {
        await addProperty({ name: 'Cheap', rooms: [room({ pricePerNight: 2000 })] });
        const dear = await addProperty({ name: 'Dear', rooms: [room({ pricePerNight: 9000 })] });

        expect(foundIds(await server.call('GET', searchPath({ minPrice: '5000' })))).toEqual([dear.id]);
      });

      it('by amenities given as a comma separated list', async () => {
        const pool = await addProperty({ name: 'Pool', amenities: ['wifi', 'pool'], rooms: [room()] });
        await addProperty({ name: 'Plain', amenities: ['wifi'], rooms: [room()] });

        expect(foundIds(await server.call('GET', searchPath({ amenities: 'WiFi, pool' })))).toEqual([pool.id]);
      });

      it('by amenities given as repeated parameters', async () => {
        const pool = await addProperty({ name: 'Pool', amenities: ['wifi', 'pool'], rooms: [room()] });
        await addProperty({ name: 'Plain', amenities: ['wifi'], rooms: [room()] });

        const response = await server.call('GET', `${searchPath()}&amenities=wifi&amenities=pool`);

        expect(foundIds(response)).toEqual([pool.id]);
      });

      it('by minimum stars', async () => {
        const five = await addProperty({ name: 'Five', starRating: 5, rooms: [room()] });
        await addProperty({ name: 'Three', starRating: 3, rooms: [room()] });

        expect(foundIds(await server.call('GET', searchPath({ minStars: '4' })))).toEqual([five.id]);
      });

      it('by locality', async () => {
        const koramangala = await addProperty({ name: 'K', locality: 'Koramangala', rooms: [room()] });
        await addProperty({ name: 'I', locality: 'Indiranagar', rooms: [room()] });

        expect(foundIds(await server.call('GET', searchPath({ locality: 'koramangala' })))).toEqual([koramangala.id]);
      });

      it('by room type', async () => {
        await addProperty({ name: 'Queens', rooms: [room()] });
        const suites = await addProperty({ name: 'Suites', rooms: [room({ type: 'suite', capacity: 4 })] });

        expect(foundIds(await server.call('GET', searchPath({ roomType: 'Suite' })))).toEqual([suites.id]);
      });

      it('by minimum stay', async () => {
        await addProperty({ name: 'Long stays only', minNights: 3, rooms: [room()] });

        expect((await server.call('GET', searchPath())).body.results).toEqual([]);
      });

      it('needs one room that meets every room condition', async () => {
        await addProperty({
          rooms: [room({ capacity: 4, pricePerNight: 9000 }), room({ capacity: 1, pricePerNight: 2000 })],
        });

        const response = await server.call('GET', searchPath({ guests: '3', maxPrice: '5000' }));

        expect(response.body.results).toEqual([]);
      });
    });

    describe('availability', () => {
      it('leaves out a room once it has been booked for those dates', async () => {
        const property = await addProperty({ rooms: [room()] });
        await server.call('POST', '/bookings', {
          guestId: 50,
          propertyId: property.id,
          roomType: 'queen',
          guestCount: 2,
          fromDate: '2026-11-11',
          toDate: '2026-11-13',
        });

        expect((await server.call('GET', searchPath())).body.results).toEqual([]);
      });

      it('still offers the room for other dates', async () => {
        const property = await addProperty({ rooms: [room()] });
        await server.call('POST', '/bookings', {
          guestId: 50,
          propertyId: property.id,
          roomType: 'queen',
          guestCount: 2,
          fromDate: '2026-11-11',
          toDate: '2026-11-13',
        });

        const response = await server.call('GET', searchPath({ fromDate: '2026-12-01', toDate: '2026-12-03' }));

        expect(foundIds(response)).toEqual([property.id]);
      });
    });

    describe('bad requests', () => {
      it.each(['city', 'fromDate', 'toDate', 'guests'])('rejects a search without %s', async (field) => {
        const query = new URLSearchParams({ city: 'Bengaluru', fromDate: '2026-11-10', toDate: '2026-11-12', guests: '2' });
        query.delete(field);

        const response = await server.call('GET', `/properties/search?${query}`);

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain(field);
      });

      it.each([
        ['guests', 'two'],
        ['guests', '2.5'],
        ['minPrice', 'cheap'],
        ['maxPrice', ''],
        ['minStars', 'x'],
      ])('rejects %s=%j', async (name, value) => {
        const response = await server.call('GET', searchPath({ [name]: value }));

        expect(response.status).toBe(400);
      });

      it('rejects dates that are not real', async () => {
        const response = await server.call('GET', searchPath({ fromDate: '2026-02-30' }));

        expect(response.status).toBe(400);
        expect(response.body.error.type).toBe('InvalidDateRangeError');
      });

      it('rejects a stay that ends before it starts', async () => {
        const response = await server.call('GET', searchPath({ fromDate: '2026-11-12', toDate: '2026-11-10' }));

        expect(response.status).toBe(400);
      });

      it('rejects a parameter that is given twice when only one is allowed', async () => {
        const response = await server.call('GET', `${searchPath()}&city=Mumbai`);

        expect(response.status).toBe(400);
      });
    });
  });

  describe('anything else', () => {
    it('answers unknown routes with a JSON 404', async () => {
      const response = await server.call('GET', '/nothing-here');

      expect(response.status).toBe(404);
      expect(response.body.error.type).toBe('NotFound');
    });

    it('answers an unsupported method on a known path with a JSON 404', async () => {
      const response = await server.call('DELETE', '/properties');

      expect(response.status).toBe(404);
    });
  });
});
