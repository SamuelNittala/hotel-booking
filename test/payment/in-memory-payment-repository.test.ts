import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryPaymentRepository } from '../../src/payment/in-memory-payment-repository';
import { Payment } from '../../src/payment/payment';

const payment = (id: number, bookingId = 10): Payment => Payment.create({ id, bookingId, amount: 5000, method: 'UPI' });

const ids = (payments: readonly Payment[]) => payments.map((found) => found.id).sort((a, b) => a - b);

describe('InMemoryPaymentRepository', () => {
  let repository: InMemoryPaymentRepository;

  beforeEach(() => {
    repository = new InMemoryPaymentRepository();
  });

  describe('save and findById', () => {
    it('returns a saved payment', async () => {
      const saved = payment(1);
      await repository.save(saved);

      expect(await repository.findById(1)).toBe(saved);
    });

    it('returns undefined for an unknown id', async () => {
      expect(await repository.findById(999)).toBeUndefined();
    });

    it('shows a status change after the payment is saved again', async () => {
      const saved = payment(1);
      await repository.save(saved);

      saved.succeed('txn-1');
      await repository.save(saved);

      expect((await repository.findById(1))?.status).toBe('success');
    });
  });

  describe('findByBookingId', () => {
    it('returns every attempt for the booking, whatever its status', async () => {
      const failed = payment(1, 10);
      failed.fail();
      const succeeded = payment(2, 10);
      succeeded.succeed('txn-1');
      await repository.save(failed);
      await repository.save(succeeded);
      await repository.save(payment(3, 10));

      expect(ids(await repository.findByBookingId(10))).toEqual([1, 2, 3]);
    });

    it('does not return attempts for other bookings', async () => {
      await repository.save(payment(1, 10));
      await repository.save(payment(2, 11));

      expect(ids(await repository.findByBookingId(10))).toEqual([1]);
    });

    it('returns an empty list for a booking with no attempts', async () => {
      expect(await repository.findByBookingId(10)).toEqual([]);
    });
  });
});
