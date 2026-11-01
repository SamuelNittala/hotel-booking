import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestGateway } from '../support/test-gateway';
import { startTestServer, TestServer } from '../support/test-server';

const upi = { upiId: 'asha@okbank' };

describe('REST API: bookings, payments and cancellation', () => {
  let clock: Date;
  let gateway: TestGateway;
  let server: TestServer;
  let propertyId: number;

  beforeEach(async () => {
    clock = new Date('2026-11-01T10:00:00Z'); // 9 days before check-in
    gateway = new TestGateway();
    server = await startTestServer({ now: () => clock, gateway });
    propertyId = await addProperty();
  });

  afterEach(async () => {
    await server.close();
  });

  async function addProperty(overrides: Record<string, unknown> = {}, roomCount = 2): Promise<number> {
    const response = await server.call('POST', '/properties', {
      ownerId: 7,
      name: 'Lakeview Inn',
      city: 'Bengaluru',
      locality: 'Indiranagar',
      latitude: 12.97,
      longitude: 77.64,
      amenities: ['wifi'],
      starRating: 4,
      rooms: Array.from({ length: roomCount }, () => ({ type: 'queen', capacity: 2, pricePerNight: 4000 })),
      ...overrides,
    });
    expect(response.status).toBe(201);
    return response.body.id;
  }

  const bookingBody = (overrides: Record<string, unknown> = {}) => ({
    guestId: 50,
    propertyId,
    roomType: 'queen',
    guestCount: 2,
    fromDate: '2026-11-10',
    toDate: '2026-11-12', // 2 nights at 4000 = 8000
    ...overrides,
  });

  const book = (overrides: Record<string, unknown> = {}) => server.call('POST', '/bookings', bookingBody(overrides));

  const bookOk = async (overrides: Record<string, unknown> = {}) => {
    const response = await book(overrides);
    expect(response.status).toBe(201);
    return response.body;
  };

  const pay = (bookingId: number, method = 'UPI', details: Record<string, string> = upi) =>
    server.call('POST', `/bookings/${bookingId}/payments`, { method, details });

  const paidBooking = async () => {
    const booking = await bookOk();
    const paid = await pay(booking.id);
    expect(paid.status).toBe(201);
    return { booking, payment: paid.body.payment };
  };

  const bookingStatus = async (bookingId: number) => (await server.call('GET', `/bookings/${bookingId}`)).body.status;

  const roomsFree = async () =>
    (
      await server.call(
        'GET',
        '/properties/search?city=Bengaluru&fromDate=2026-11-10&toDate=2026-11-12&guests=2',
      )
    ).body.results.flatMap((result: any) => result.rooms);

  describe('POST /bookings', () => {
    it('creates a pending booking for a room of the requested type and prices the stay', async () => {
      const response = await book();

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        guestId: 50,
        propertyId,
        guestCount: 2,
        fromDate: '2026-11-10',
        toDate: '2026-11-12',
        totalAmount: 8000,
        status: 'pending',
        createdAt: '2026-11-01T10:00:00.000Z',
      });
      expect(response.body.id).toEqual(expect.any(Number));
      expect(response.body.roomId).toEqual(expect.any(Number));
    });

    it('holds the dates, so the room is gone from search', async () => {
      await bookOk();

      expect(await roomsFree()).toHaveLength(1);
    });

    it('gives different rooms to successive bookings, then runs out', async () => {
      const first = await bookOk();
      const second = await bookOk();
      const third = await book();

      expect(first.roomId).not.toBe(second.roomId);
      expect(third.status).toBe(409);
      expect(third.body.error.type).toBe('NoRoomAvailableError');
    });

    it('gives the last room to only one of two guests asking at the same time', async () => {
      const single = await addProperty({ name: 'One room' }, 1);

      const responses = await Promise.all([
        book({ propertyId: single, guestId: 1 }),
        book({ propertyId: single, guestId: 2 }),
      ]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    });

    it('answers 404 for an unknown property', async () => {
      const response = await book({ propertyId: 999 });

      expect(response.status).toBe(404);
      expect(response.body.error.type).toBe('PropertyNotFoundError');
    });

    it('answers 422 when the property has no room of that type', async () => {
      const response = await book({ roomType: 'suite' });

      expect(response.status).toBe(422);
      expect(response.body.error.type).toBe('NoMatchingRoomError');
    });

    it('answers 422 when no room holds that many guests', async () => {
      const response = await book({ guestCount: 5 });

      expect(response.status).toBe(422);
    });

    it('answers 422 when the stay is shorter than the property minimum', async () => {
      const strict = await addProperty({ name: 'Long stays', minNights: 3 });

      const response = await book({ propertyId: strict });

      expect(response.status).toBe(422);
      expect(response.body.error.type).toBe('StayTooShortError');
    });

    it.each(['guestId', 'propertyId', 'roomType', 'guestCount', 'fromDate', 'toDate'])(
      'rejects a request without %s',
      async (field) => {
        const body: Record<string, unknown> = bookingBody();
        delete body[field];

        const response = await server.call('POST', '/bookings', body);

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain(field);
      },
    );

    it.each([
      ['guestCount', 1.5],
      ['guestId', 'fifty'],
      ['propertyId', '1'],
    ])('rejects %s=%j', async (field, value) => {
      const response = await book({ [field]: value });

      expect(response.status).toBe(400);
    });

    it('rejects dates that are not real, or end before they start', async () => {
      expect((await book({ fromDate: '2026-02-30' })).status).toBe(400);
      expect((await book({ fromDate: '2026-11-12', toDate: '2026-11-10' })).status).toBe(400);
    });
  });

  describe('GET /bookings/:bookingId', () => {
    it('returns the booking', async () => {
      const booking = await bookOk();

      const response = await server.call('GET', `/bookings/${booking.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual(booking);
    });

    it('answers 404 for an unknown booking', async () => {
      const response = await server.call('GET', '/bookings/999');

      expect(response.status).toBe(404);
      expect(response.body.error.type).toBe('BookingNotFoundError');
    });

    it('answers 400 for an id that is not a number', async () => {
      expect((await server.call('GET', '/bookings/abc')).status).toBe(400);
    });
  });

  describe('POST /bookings/:bookingId/payments', () => {
    it('answers 201 and confirms the booking when the money is taken', async () => {
      const booking = await bookOk();

      const response = await pay(booking.id);

      expect(response.status).toBe(201);
      expect(response.body.payment).toMatchObject({
        bookingId: booking.id,
        amount: 8000,
        method: 'UPI',
        status: 'success',
        refundedAmount: 0,
      });
      expect(response.body.payment.gatewayReference).toEqual(expect.any(String));
      expect(response.body.booking.status).toBe('confirmed');
      expect(await bookingStatus(booking.id)).toBe('confirmed');
    });

    it.each([
      ['WALLET', { walletId: 'wallet-1' }],
      ['CARD', { cardNumber: '4111 1111 1111 1111' }],
    ])('works with %s', async (method, details) => {
      const booking = await bookOk();

      const response = await pay(booking.id, method, details);

      expect(response.status).toBe(201);
      expect(response.body.payment.method).toBe(method);
    });

    it('answers 402 for a declined payment and leaves the booking pending', async () => {
      const booking = await bookOk();
      gateway.declining = true;

      const response = await pay(booking.id);

      expect(response.status).toBe(402);
      expect(response.body.payment.status).toBe('failure');
      expect(response.body.booking.status).toBe('pending');
    });

    it('lets the guest try again after a decline', async () => {
      const booking = await bookOk();
      gateway.declining = true;
      await pay(booking.id);
      gateway.declining = false;

      const retry = await pay(booking.id);

      expect(retry.status).toBe(201);
      expect(await bookingStatus(booking.id)).toBe('confirmed');
    });

    it('expires the booking after three declines, frees the room, and refuses further attempts', async () => {
      const booking = await bookOk();
      gateway.declining = true;
      await pay(booking.id);
      await pay(booking.id);
      const third = await pay(booking.id);
      gateway.declining = false;

      expect(third.body.booking.status).toBe('expired');
      expect(await roomsFree()).toHaveLength(2);
      const fourth = await pay(booking.id);
      expect(fourth.status).toBe(409);
      expect(fourth.body.error.type).toBe('BookingNotPayableError');
    });

    it('answers 409 when the booking is already paid', async () => {
      const { booking } = await paidBooking();

      const response = await pay(booking.id);

      expect(response.status).toBe(409);
      expect(response.body.error.type).toBe('BookingNotPayableError');
      expect(gateway.charges).toHaveLength(1);
    });

    it('answers 409 and pays the money back when the booking was cancelled while the gateway worked', async () => {
      const booking = await bookOk();
      gateway.duringCharge = async () => {
        await server.services.bookingService.cancel(booking.id);
      };

      const response = await pay(booking.id);

      expect(response.status).toBe(409);
      expect(response.body.payment.status).toBe('refunded');
      expect(response.body.payment.refundedAmount).toBe(8000);
      expect(response.body.booking.status).toBe('cancelled');
    });

    it('answers 409 to the second of two attempts started together, charging once', async () => {
      const booking = await bookOk();

      const responses = await Promise.all([pay(booking.id), pay(booking.id)]);

      expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
      expect(gateway.charges).toHaveLength(1);
    });

    it('answers 404 for an unknown booking', async () => {
      expect((await pay(999)).status).toBe(404);
    });

    it('answers 400 for a method that is not supported', async () => {
      const booking = await bookOk();

      const response = await pay(booking.id, 'CRYPTO', {});

      expect(response.status).toBe(400);
      expect(response.body.error.type).toBe('UnsupportedPaymentMethodError');
    });

    it('answers 400 for payer details the method does not accept, and charges nothing', async () => {
      const booking = await bookOk();

      const response = await pay(booking.id, 'UPI', { upiId: 'nope' });

      expect(response.status).toBe(400);
      expect(gateway.charges).toEqual([]);
      expect(await bookingStatus(booking.id)).toBe('pending');
    });

    it('answers 400 when the details are missing', async () => {
      const booking = await bookOk();

      const response = await server.call('POST', `/bookings/${booking.id}/payments`, { method: 'UPI' });

      expect(response.status).toBe(400);
    });

    it('answers 400 when the method is missing or the details are not all strings', async () => {
      const booking = await bookOk();

      expect((await server.call('POST', `/bookings/${booking.id}/payments`, { details: upi })).status).toBe(400);
      expect(
        (await server.call('POST', `/bookings/${booking.id}/payments`, { method: 'UPI', details: { upiId: 5 } })).status,
      ).toBe(400);
    });
  });

  describe('POST /payments/:paymentId/refunds', () => {
    it('pays back the whole payment when no amount is given', async () => {
      const { payment } = await paidBooking();

      const response = await server.call('POST', `/payments/${payment.id}/refunds`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ status: 'refunded', refundedAmount: 8000 });
    });

    it('pays back part of the payment', async () => {
      const { payment } = await paidBooking();

      const response = await server.call('POST', `/payments/${payment.id}/refunds`, { amount: 3000 });

      expect(response.body).toMatchObject({ status: 'refunded', refundedAmount: 3000 });
    });

    it('does not touch the booking', async () => {
      const { booking, payment } = await paidBooking();

      await server.call('POST', `/payments/${payment.id}/refunds`);

      expect(await bookingStatus(booking.id)).toBe('confirmed');
    });

    it('answers 404 for an unknown payment', async () => {
      expect((await server.call('POST', '/payments/999/refunds')).status).toBe(404);
    });

    it('answers 400 for an amount larger than the payment, and refunds nothing', async () => {
      const { payment } = await paidBooking();

      const response = await server.call('POST', `/payments/${payment.id}/refunds`, { amount: 9000 });

      expect(response.status).toBe(400);
      expect(gateway.refunds).toEqual([]);
    });

    it('answers 400 for an amount that is not a number', async () => {
      const { payment } = await paidBooking();

      expect((await server.call('POST', `/payments/${payment.id}/refunds`, { amount: 'all' })).status).toBe(400);
    });

    it('answers 409 when the payment was already refunded', async () => {
      const { payment } = await paidBooking();
      await server.call('POST', `/payments/${payment.id}/refunds`);

      const again = await server.call('POST', `/payments/${payment.id}/refunds`);

      expect(again.status).toBe(409);
      expect(gateway.refunds).toHaveLength(1);
    });

    it('answers 502 when the gateway refuses, and allows a retry', async () => {
      const { payment } = await paidBooking();
      gateway.failRefunds = true;

      const refused = await server.call('POST', `/payments/${payment.id}/refunds`);
      gateway.failRefunds = false;
      const retry = await server.call('POST', `/payments/${payment.id}/refunds`);

      expect(refused.status).toBe(502);
      expect(refused.body.error.type).toBe('RefundFailedError');
      expect(retry.status).toBe(200);
    });
  });

  describe('POST /bookings/:bookingId/cancel', () => {
    it('cancels a paid booking, pays back in full 9 days before check-in, and frees the room', async () => {
      const { booking, payment } = await paidBooking();

      const response = await server.call('POST', `/bookings/${booking.id}/cancel`);

      expect(response.status).toBe(200);
      expect(response.body.booking.status).toBe('cancelled');
      expect(response.body).toMatchObject({ refundAmount: 8000, refundStatus: 'refunded', paymentId: payment.id });
      expect(await roomsFree()).toHaveLength(2);
    });

    it('pays back half 3 days before check-in', async () => {
      const { booking } = await paidBooking();
      clock = new Date('2026-11-07T10:00:00Z');

      const response = await server.call('POST', `/bookings/${booking.id}/cancel`);

      expect(response.body).toMatchObject({ refundAmount: 4000, refundStatus: 'refunded' });
    });

    it('pays back nothing the day before check-in, but still cancels', async () => {
      const { booking } = await paidBooking();
      clock = new Date('2026-11-09T10:00:00Z');

      const response = await server.call('POST', `/bookings/${booking.id}/cancel`);

      expect(response.body.booking.status).toBe('cancelled');
      expect(response.body).toMatchObject({ refundAmount: 0, refundStatus: 'none', paymentId: null });
    });

    it('cancels a booking that was not paid, with no refund', async () => {
      const booking = await bookOk();

      const response = await server.call('POST', `/bookings/${booking.id}/cancel`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ refundAmount: 0, refundStatus: 'none', paymentId: null });
      expect(await roomsFree()).toHaveLength(2);
    });

    it('answers 200 with refundStatus failed when the gateway refuses, and the refund can be retried', async () => {
      const { booking, payment } = await paidBooking();
      gateway.failRefunds = true;

      const response = await server.call('POST', `/bookings/${booking.id}/cancel`);
      gateway.failRefunds = false;
      const retry = await server.call('POST', `/payments/${response.body.paymentId}/refunds`, {
        amount: response.body.refundAmount,
      });

      expect(response.status).toBe(200);
      expect(response.body.booking.status).toBe('cancelled');
      expect(response.body).toMatchObject({ refundStatus: 'failed', refundAmount: 8000, paymentId: payment.id });
      expect(retry.body.status).toBe('refunded');
    });

    it('answers 409 when the booking is already cancelled, refunding only once', async () => {
      const { booking } = await paidBooking();
      await server.call('POST', `/bookings/${booking.id}/cancel`);

      const again = await server.call('POST', `/bookings/${booking.id}/cancel`);

      expect(again.status).toBe(409);
      expect(gateway.refunds).toHaveLength(1);
    });

    it('answers 404 for an unknown booking', async () => {
      expect((await server.call('POST', '/bookings/999/cancel')).status).toBe(404);
    });

    it('answers 400 for an id that is not a number', async () => {
      expect((await server.call('POST', '/bookings/abc/cancel')).status).toBe(400);
    });

    it('lets another guest book the freed room', async () => {
      const single = await addProperty({ name: 'One room' }, 1);
      const first = await bookOk({ propertyId: single });
      await server.call('POST', `/bookings/${first.id}/cancel`);

      const second = await book({ propertyId: single, guestId: 51 });

      expect(second.status).toBe(201);
    });
  });

  describe('unpaid bookings running out of time', () => {
    it('frees the room when the sweep runs after the payment window', async () => {
      const single = await addProperty({ name: 'One room' }, 1);
      const booking = await bookOk({ propertyId: single });
      clock = new Date('2026-11-01T10:20:00Z');

      const result = await server.services.expiry.expireOverdue();

      expect(result.expired).toEqual([booking.id]);
      expect(await bookingStatus(booking.id)).toBe('expired');
      expect((await book({ propertyId: single, guestId: 51 })).status).toBe(201);
    });
  });

  describe('a whole stay from start to finish', () => {
    it('add a property, search, book, pay, cancel, and search again', async () => {
      const own = await addProperty({ name: 'Journey Inn', city: 'Mysuru' }, 1);
      const search = () =>
        server.call('GET', '/properties/search?city=Mysuru&fromDate=2026-11-10&toDate=2026-11-12&guests=2');

      expect((await search()).body.results).toHaveLength(1);
      const booking = await bookOk({ propertyId: own });
      expect((await search()).body.results).toEqual([]);
      expect((await pay(booking.id)).status).toBe(201);
      expect(await bookingStatus(booking.id)).toBe('confirmed');
      expect((await server.call('POST', `/bookings/${booking.id}/cancel`)).status).toBe(200);
      expect((await search()).body.results).toHaveLength(1);
    });
  });
});
