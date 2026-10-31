import { beforeEach, describe, expect, it } from 'vitest';
import { Booking } from '../../src/booking/booking';
import { InMemoryBookingRepository } from '../../src/booking/in-memory-booking-repository';
import { DateRange } from '../../src/shared/date-range';

const booking = (id: number, overrides: { guestId?: number; createdAt?: Date } = {}): Booking =>
  Booking.create({
    id,
    guestId: overrides.guestId ?? 10,
    propertyId: 20,
    roomId: 30,
    guestCount: 2,
    dateRange: DateRange.of('2026-11-01', '2026-11-03'),
    totalAmount: 5000,
    createdAt: overrides.createdAt ?? new Date('2026-10-31T10:00:00Z'),
  });

const ids = (bookings: readonly Booking[]) => bookings.map((found) => found.id).sort((a, b) => a - b);

describe('InMemoryBookingRepository', () => {
  let repository: InMemoryBookingRepository;

  beforeEach(() => {
    repository = new InMemoryBookingRepository();
  });

  describe('save and findById', () => {
    it('returns a saved booking', async () => {
      const saved = booking(1);
      await repository.save(saved);

      expect(await repository.findById(1)).toBe(saved);
    });

    it('returns undefined for an unknown id', async () => {
      expect(await repository.findById(999)).toBeUndefined();
    });

    it('shows a status change after the booking is saved again', async () => {
      const saved = booking(1);
      await repository.save(saved);

      saved.confirm();
      await repository.save(saved);

      expect((await repository.findById(1))?.status).toBe('confirmed');
    });

    it('keeps one booking per id when saved again', async () => {
      await repository.save(booking(1, { guestId: 10 }));
      await repository.save(booking(1, { guestId: 10 }));

      expect(await repository.findByGuestId(10)).toHaveLength(1);
    });
  });

  describe('findByGuestId', () => {
    it("returns only that guest's bookings, whatever their status", async () => {
      const cancelled = booking(2, { guestId: 10 });
      cancelled.cancel();
      await repository.save(booking(1, { guestId: 10 }));
      await repository.save(cancelled);
      await repository.save(booking(3, { guestId: 11 }));

      expect(ids(await repository.findByGuestId(10))).toEqual([1, 2]);
    });

    it('returns an empty list for a guest with no bookings', async () => {
      expect(await repository.findByGuestId(10)).toEqual([]);
    });
  });

  describe('findPendingCreatedBefore', () => {
    const cutoff = new Date('2026-10-31T10:30:00Z');

    it('returns pending bookings created before the cutoff', async () => {
      await repository.save(booking(1, { createdAt: new Date('2026-10-31T10:00:00Z') }));

      expect(ids(await repository.findPendingCreatedBefore(cutoff))).toEqual([1]);
    });

    it('leaves out pending bookings created after the cutoff', async () => {
      await repository.save(booking(1, { createdAt: new Date('2026-10-31T10:45:00Z') }));

      expect(await repository.findPendingCreatedBefore(cutoff)).toEqual([]);
    });

    it('leaves out a booking created exactly at the cutoff', async () => {
      await repository.save(booking(1, { createdAt: cutoff }));

      expect(await repository.findPendingCreatedBefore(cutoff)).toEqual([]);
    });

    it('leaves out bookings that are no longer pending', async () => {
      const old = new Date('2026-10-31T09:00:00Z');
      const confirmed = booking(1, { createdAt: old });
      confirmed.confirm();
      const cancelled = booking(2, { createdAt: old });
      cancelled.cancel();
      const expired = booking(3, { createdAt: old });
      expired.expire();
      await repository.save(confirmed);
      await repository.save(cancelled);
      await repository.save(expired);
      await repository.save(booking(4, { createdAt: old }));

      expect(ids(await repository.findPendingCreatedBefore(cutoff))).toEqual([4]);
    });
  });
});
