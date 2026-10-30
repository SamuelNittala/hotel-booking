import { beforeEach, describe, expect, it } from 'vitest';
import { BookingAlreadyReservedError, RoomUnavailableError } from '../../src/availability/availability';
import { InMemoryAvailability } from '../../src/availability/in-memory-availability';
import { DateRange } from '../../src/shared/date-range';

const range = (from: string, to: string) => DateRange.of(from, to);

describe('InMemoryAvailability', () => {
  let availability: InMemoryAvailability;

  beforeEach(() => {
    availability = new InMemoryAvailability();
  });

  describe('check', () => {
    it('says a room that was never booked is free', async () => {
      expect(await availability.check(range('2026-11-01', '2026-11-03'), 1)).toBe(true);
    });

    it('says a room is not free for dates that overlap an existing reservation', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      expect(await availability.check(range('2026-11-02', '2026-11-04'), 1)).toBe(false);
    });

    it('says a room is free for a stay that starts on the checkout day', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      expect(await availability.check(range('2026-11-03', '2026-11-05'), 1)).toBe(true);
    });

    it('does not let a reservation on one room affect another room', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      expect(await availability.check(range('2026-11-01', '2026-11-03'), 2)).toBe(true);
    });

    it('does not reserve anything', async () => {
      await availability.check(range('2026-11-01', '2026-11-03'), 1);

      expect(await availability.check(range('2026-11-01', '2026-11-03'), 1)).toBe(true);
    });
  });

  describe('reserve', () => {
    it('returns the reservation it created', async () => {
      const dateRange = range('2026-11-01', '2026-11-03');

      const reservation = await availability.reserve(dateRange, 1, 100);

      expect(reservation).toEqual({ bookingId: 100, roomId: 1, dateRange });
    });

    it('lets back-to-back stays on the same room both succeed', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      await expect(availability.reserve(range('2026-11-03', '2026-11-05'), 1, 101)).resolves.toBeDefined();
    });

    it('rejects an overlapping reservation with RoomUnavailableError', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      await expect(availability.reserve(range('2026-11-02', '2026-11-04'), 1, 101)).rejects.toThrow(
        RoomUnavailableError,
      );
    });

    it('rejects a reservation identical to an existing one', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      await expect(availability.reserve(range('2026-11-01', '2026-11-03'), 1, 101)).rejects.toThrow(
        RoomUnavailableError,
      );
    });

    it('rejects a reservation that sits inside an existing one', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-10'), 1, 100);

      await expect(availability.reserve(range('2026-11-03', '2026-11-05'), 1, 101)).rejects.toThrow(
        RoomUnavailableError,
      );
    });

    it('lets two bookings take the same dates on different rooms', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      await expect(availability.reserve(range('2026-11-01', '2026-11-03'), 2, 101)).resolves.toBeDefined();
    });

    it('stores nothing for a rejected reservation', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);
      await availability.reserve(range('2026-11-02', '2026-11-04'), 1, 101).catch(() => undefined);

      expect(await availability.release(101)).toBe(false);
      expect(await availability.check(range('2026-11-03', '2026-11-05'), 1)).toBe(true);
    });
  });

  describe('reserve with a booking id that already holds a reservation', () => {
    it('rejects it with BookingAlreadyReservedError, even for free dates on the same room', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      await expect(availability.reserve(range('2026-11-10', '2026-11-12'), 1, 100)).rejects.toThrow(
        BookingAlreadyReservedError,
      );
    });

    it('rejects it for a different room too', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      await expect(availability.reserve(range('2026-11-10', '2026-11-12'), 2, 100)).rejects.toThrow(
        BookingAlreadyReservedError,
      );
    });

    it('keeps the first reservation and stores nothing for the rejected one', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);
      await availability.reserve(range('2026-11-10', '2026-11-12'), 1, 100).catch(() => undefined);

      expect(await availability.check(range('2026-11-01', '2026-11-03'), 1)).toBe(false);
      expect(await availability.check(range('2026-11-10', '2026-11-12'), 1)).toBe(true);
    });

    it('lets only one of two simultaneous reserves with the same booking id succeed', async () => {
      const results = await Promise.allSettled([
        availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100),
        availability.reserve(range('2026-11-10', '2026-11-12'), 2, 100),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(rejected[0]?.reason).toBeInstanceOf(BookingAlreadyReservedError);
    });
  });

  describe('release', () => {
    it('returns true and frees the dates of the released booking', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      expect(await availability.release(100)).toBe(true);
      expect(await availability.check(range('2026-11-01', '2026-11-03'), 1)).toBe(true);
    });

    it("frees only that booking's nights", async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);
      await availability.reserve(range('2026-11-20', '2026-11-22'), 1, 101);

      await availability.release(100);

      expect(await availability.check(range('2026-11-01', '2026-11-03'), 1)).toBe(true);
      expect(await availability.check(range('2026-11-20', '2026-11-22'), 1)).toBe(false);
    });

    it('lets the freed dates be booked again', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);
      await availability.release(100);

      await expect(availability.reserve(range('2026-11-01', '2026-11-03'), 1, 101)).resolves.toBeDefined();
    });

    it('returns false for a booking id it does not know', async () => {
      expect(await availability.release(999)).toBe(false);
    });

    it('is safe to repeat: releasing twice returns true then false without throwing', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);

      expect(await availability.release(100)).toBe(true);
      expect(await availability.release(100)).toBe(false);
    });

    it('does not touch other rooms or bookings', async () => {
      await availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100);
      await availability.reserve(range('2026-11-01', '2026-11-03'), 2, 101);

      await availability.release(100);

      expect(await availability.check(range('2026-11-01', '2026-11-03'), 2)).toBe(false);
    });
  });

  describe('simultaneous reservations', () => {
    it('lets exactly one of two guests take the last room', async () => {
      const dateRange = range('2026-11-01', '2026-11-03');

      const results = await Promise.allSettled([
        availability.reserve(dateRange, 1, 100),
        availability.reserve(dateRange, 1, 101),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(RoomUnavailableError);
    });

    it('lets exactly one of many guests take the same room and dates', async () => {
      const dateRange = range('2026-11-01', '2026-11-03');

      const results = await Promise.allSettled(
        [100, 101, 102, 103, 104].map((bookingId) => availability.reserve(dateRange, 1, bookingId)),
      );

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(4);
    });

    it('lets two simultaneous back-to-back stays both succeed', async () => {
      const results = await Promise.allSettled([
        availability.reserve(range('2026-11-01', '2026-11-03'), 1, 100),
        availability.reserve(range('2026-11-03', '2026-11-05'), 1, 101),
      ]);

      expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    });
  });
});
