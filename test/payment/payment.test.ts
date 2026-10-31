import { describe, expect, it } from 'vitest';
import { InvalidPaymentError, InvalidPaymentTransitionError } from '../../src/payment/errors';
import { Payment, PaymentProps } from '../../src/payment/payment';
import { PaymentStatus } from '../../src/payment/payment-status';

const props = (overrides: Partial<PaymentProps> = {}): PaymentProps => ({
  id: 1,
  bookingId: 10,
  amount: 5000,
  method: 'UPI',
  ...overrides,
});

const paymentIn = (status: PaymentStatus): Payment => {
  const payment = Payment.create(props());
  if (status === 'success') payment.succeed('txn-1');
  if (status === 'failure') payment.fail();
  if (status === 'cancelled') payment.cancel();
  if (status === 'refunded') {
    payment.succeed('txn-1');
    payment.refund(5000);
  }
  return payment;
};

type Action = 'succeed' | 'fail' | 'cancel' | 'refund';
const perform = (payment: Payment, action: Action): void => {
  if (action === 'refund') payment.refund(5000);
  else if (action === 'succeed') payment.succeed('txn-2');
  else payment[action]();
};
const resultingStatus: Record<Action, PaymentStatus> = {
  succeed: 'success',
  fail: 'failure',
  cancel: 'cancelled',
  refund: 'refunded',
};

describe('Payment.create', () => {
  it('creates a pending payment with the given details and nothing refunded', () => {
    const payment = Payment.create(props());

    expect(payment.status).toBe('pending');
    expect(payment.id).toBe(1);
    expect(payment.bookingId).toBe(10);
    expect(payment.amount).toBe(5000);
    expect(payment.method).toBe('UPI');
    expect(payment.refundedAmount).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects an amount of %s', (amount) => {
    expect(() => Payment.create(props({ amount }))).toThrow(InvalidPaymentError);
  });

  it.each(['', '   '])('rejects an empty method %j', (method) => {
    expect(() => Payment.create(props({ method }))).toThrow(InvalidPaymentError);
  });
});

describe('Payment status moves', () => {
  describe('legal moves', () => {
    it.each<[PaymentStatus, Action]>([
      ['pending', 'succeed'],
      ['pending', 'fail'],
      ['pending', 'cancel'],
      ['success', 'refund'],
    ])('a %s payment can %s', (from, action) => {
      const payment = paymentIn(from);

      perform(payment, action);

      expect(payment.status).toBe(resultingStatus[action]);
    });
  });

  describe('illegal moves', () => {
    it.each<[PaymentStatus, Action]>([
      ['pending', 'refund'],
      ['success', 'succeed'],
      ['success', 'fail'],
      ['success', 'cancel'],
      ['failure', 'succeed'],
      ['failure', 'fail'],
      ['failure', 'cancel'],
      ['failure', 'refund'],
      ['cancelled', 'succeed'],
      ['cancelled', 'fail'],
      ['cancelled', 'cancel'],
      ['cancelled', 'refund'],
      ['refunded', 'succeed'],
      ['refunded', 'fail'],
      ['refunded', 'cancel'],
      ['refunded', 'refund'],
    ])('a %s payment cannot %s', (from, action) => {
      const payment = paymentIn(from);

      expect(() => perform(payment, action)).toThrow(InvalidPaymentTransitionError);
    });

    it('leaves the status unchanged after an illegal move', () => {
      const payment = paymentIn('failure');

      expect(() => payment.succeed('txn-2')).toThrow(InvalidPaymentTransitionError);

      expect(payment.status).toBe('failure');
    });

    it('names the payment and both statuses in the error', () => {
      const payment = paymentIn('failure');

      expect(() => payment.succeed('txn-2')).toThrow('Payment 1 cannot move from failure to success');
    });
  });
});

describe('Payment.succeed', () => {
  it('keeps the gateway reference', () => {
    const payment = Payment.create(props());

    payment.succeed('txn-9');

    expect(payment.gatewayReference).toBe('txn-9');
  });

  it('has no gateway reference before it succeeds', () => {
    expect(Payment.create(props()).gatewayReference).toBeUndefined();
  });

  it.each(['', '   '])('rejects an empty reference %j and stays pending', (reference) => {
    const payment = Payment.create(props());

    expect(() => payment.succeed(reference)).toThrow(InvalidPaymentError);

    expect(payment.status).toBe('pending');
    expect(payment.gatewayReference).toBeUndefined();
  });
});

describe('Payment.assertCanRefund', () => {
  it('accepts a full or partial amount on a successful payment', () => {
    const payment = paymentIn('success');

    expect(() => payment.assertCanRefund(5000)).not.toThrow();
    expect(() => payment.assertCanRefund(100)).not.toThrow();
  });

  it('changes nothing', () => {
    const payment = paymentIn('success');

    payment.assertCanRefund(5000);

    expect(payment.status).toBe('success');
    expect(payment.refundedAmount).toBe(0);
  });

  it.each([0, -1, 5001, Number.NaN])('rejects an amount of %s', (amount) => {
    expect(() => paymentIn('success').assertCanRefund(amount)).toThrow(InvalidPaymentError);
  });

  it('rejects a payment that is not successful', () => {
    expect(() => paymentIn('pending').assertCanRefund(5000)).toThrow(InvalidPaymentTransitionError);
  });
});

describe('Payment.refund', () => {
  it('records a full refund', () => {
    const payment = paymentIn('success');

    payment.refund(5000);

    expect(payment.status).toBe('refunded');
    expect(payment.refundedAmount).toBe(5000);
  });

  it('records a partial refund', () => {
    const payment = paymentIn('success');

    payment.refund(2500);

    expect(payment.status).toBe('refunded');
    expect(payment.refundedAmount).toBe(2500);
  });

  it.each([0, -100, Number.NaN, 5000.01])('rejects a refund of %s and leaves the payment as it was', (refundAmount) => {
    const payment = paymentIn('success');

    expect(() => payment.refund(refundAmount)).toThrow(InvalidPaymentError);

    expect(payment.status).toBe('success');
    expect(payment.refundedAmount).toBe(0);
  });

  it('reports an illegal move before a bad amount when the payment is not successful', () => {
    const payment = paymentIn('failure');

    expect(() => payment.refund(-1)).toThrow(InvalidPaymentTransitionError);
  });

  it('cannot be refunded a second time, and keeps the first refund amount', () => {
    const payment = paymentIn('success');
    payment.refund(2500);

    expect(() => payment.refund(2500)).toThrow(InvalidPaymentTransitionError);

    expect(payment.refundedAmount).toBe(2500);
  });
});
