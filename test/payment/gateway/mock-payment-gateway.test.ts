import { describe, expect, it } from 'vitest';
import { MockPaymentGateway } from '../../../src/payment/gateway/mock-payment-gateway';

const chargeRequest = { method: 'UPI', amount: 1000, payer: 'asha@okbank' };

describe('MockPaymentGateway', () => {
  it('succeeds by default and returns a reference', async () => {
    const gateway = new MockPaymentGateway();

    expect(await gateway.charge(chargeRequest)).toEqual({ status: 'success', reference: 'mock-txn-1' });
  });

  it('gives each successful charge a different reference', async () => {
    const gateway = new MockPaymentGateway();

    const first = await gateway.charge(chargeRequest);
    const second = await gateway.charge(chargeRequest);

    expect(first).not.toEqual(second);
  });

  it('declines a charge when told to, with a reason', async () => {
    const gateway = new MockPaymentGateway((request) => request.amount > 500);

    const outcome = await gateway.charge(chargeRequest);

    expect(outcome.status).toBe('failure');
    expect(outcome).toHaveProperty('reason');
  });

  it('only declines the charges it is told to', async () => {
    const gateway = new MockPaymentGateway((request) => request.payer === 'bad@okbank');

    expect((await gateway.charge({ ...chargeRequest, payer: 'bad@okbank' })).status).toBe('failure');
    expect((await gateway.charge(chargeRequest)).status).toBe('success');
  });

  it('records every charge and refund request', async () => {
    const gateway = new MockPaymentGateway();
    const charged = await gateway.charge(chargeRequest);
    if (charged.status !== 'success') throw new Error('expected the charge to succeed');

    await gateway.refund({ reference: charged.reference, amount: 400 });

    expect(gateway.charges).toEqual([chargeRequest]);
    expect(gateway.refunds).toEqual([{ reference: charged.reference, amount: 400 }]);
  });

  it('refunds a charge it issued', async () => {
    const gateway = new MockPaymentGateway();
    const charged = await gateway.charge(chargeRequest);
    if (charged.status !== 'success') throw new Error('expected the charge to succeed');

    const refunded = await gateway.refund({ reference: charged.reference, amount: 1000 });

    expect(refunded.status).toBe('success');
  });

  it('fails a refund for a reference it never issued', async () => {
    const gateway = new MockPaymentGateway();

    const outcome = await gateway.refund({ reference: 'nope', amount: 100 });

    expect(outcome).toEqual({ status: 'failure', reason: 'Unknown transaction nope' });
  });

  it('does not issue a reference for a declined charge', async () => {
    const gateway = new MockPaymentGateway(() => true);
    await gateway.charge(chargeRequest);

    expect((await gateway.refund({ reference: 'mock-txn-1', amount: 100 })).status).toBe('failure');
  });
});
