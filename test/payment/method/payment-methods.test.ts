import { beforeEach, describe, expect, it } from 'vitest';
import { InvalidPaymentError } from '../../../src/payment/errors';
import { CardPaymentMethod } from '../../../src/payment/method/card-payment-method';
import { UpiPaymentMethod } from '../../../src/payment/method/upi-payment-method';
import { WalletPaymentMethod } from '../../../src/payment/method/wallet-payment-method';
import { MockPaymentGateway } from '../../../src/payment/gateway/mock-payment-gateway';

let gateway: MockPaymentGateway;

beforeEach(() => {
  gateway = new MockPaymentGateway();
});

describe('UpiPaymentMethod', () => {
  it('is named UPI', () => {
    expect(new UpiPaymentMethod(gateway).name).toBe('UPI');
  });

  it('charges the gateway with the UPI id as the payer', async () => {
    const outcome = await new UpiPaymentMethod(gateway).charge(1500, { upiId: 'asha@okbank' });

    expect(outcome.status).toBe('success');
    expect(gateway.charges).toEqual([{ method: 'UPI', amount: 1500, payer: 'asha@okbank' }]);
  });

  it.each(['', '   ', 'asha', 'asha@', '@okbank', 'as ha@okbank', 'a@okbank', 'asha@ok1'])(
    'rejects the UPI id %j without calling the gateway',
    async (upiId) => {
      await expect(new UpiPaymentMethod(gateway).charge(1500, { upiId })).rejects.toThrow(InvalidPaymentError);
      expect(gateway.charges).toHaveLength(0);
    },
  );

  it('rejects missing details', async () => {
    await expect(new UpiPaymentMethod(gateway).charge(1500, {})).rejects.toThrow(InvalidPaymentError);
  });

  it('returns the gateway failure when the payment is declined', async () => {
    const declining = new MockPaymentGateway(() => true);

    const outcome = await new UpiPaymentMethod(declining).charge(1500, { upiId: 'asha@okbank' });

    expect(outcome.status).toBe('failure');
  });
});

describe('WalletPaymentMethod', () => {
  it('is named WALLET', () => {
    expect(new WalletPaymentMethod(gateway).name).toBe('WALLET');
  });

  it('charges the gateway with the wallet id as the payer', async () => {
    await new WalletPaymentMethod(gateway).charge(700, { walletId: 'w-42' });

    expect(gateway.charges).toEqual([{ method: 'WALLET', amount: 700, payer: 'w-42' }]);
  });

  it.each(['', '   '])('rejects the wallet id %j', async (walletId) => {
    await expect(new WalletPaymentMethod(gateway).charge(700, { walletId })).rejects.toThrow(InvalidPaymentError);
    expect(gateway.charges).toHaveLength(0);
  });

  it('rejects missing details', async () => {
    await expect(new WalletPaymentMethod(gateway).charge(700, {})).rejects.toThrow(InvalidPaymentError);
  });
});

describe('CardPaymentMethod', () => {
  it('is named CARD', () => {
    expect(new CardPaymentMethod(gateway).name).toBe('CARD');
  });

  it('passes only the last four digits to the gateway', async () => {
    await new CardPaymentMethod(gateway).charge(900, { cardNumber: '4111111111111111' });

    expect(gateway.charges).toEqual([{ method: 'CARD', amount: 900, payer: 'card-ending-1111' }]);
  });

  it('accepts spaces and dashes in the card number', async () => {
    await new CardPaymentMethod(gateway).charge(900, { cardNumber: '4111 1111-1111 2345' });

    expect(gateway.charges[0]?.payer).toBe('card-ending-2345');
  });

  it.each(['', '1234', '411111111111', '41111111111111111111', '4111abcd11111111'])(
    'rejects the card number %j',
    async (cardNumber) => {
      await expect(new CardPaymentMethod(gateway).charge(900, { cardNumber })).rejects.toThrow(InvalidPaymentError);
      expect(gateway.charges).toHaveLength(0);
    },
  );
});

describe('every gateway-backed method', () => {
  it.each([0, -50, Number.NaN, Number.POSITIVE_INFINITY])('rejects a charge of %s', async (amount) => {
    await expect(new UpiPaymentMethod(gateway).charge(amount, { upiId: 'asha@okbank' })).rejects.toThrow(
      InvalidPaymentError,
    );
    expect(gateway.charges).toHaveLength(0);
  });

  it('refunds through the gateway using the reference from the charge', async () => {
    const method = new UpiPaymentMethod(gateway);
    const charged = await method.charge(1500, { upiId: 'asha@okbank' });
    if (charged.status !== 'success') throw new Error('expected the charge to succeed');

    const refunded = await method.refund(charged.reference, 600);

    expect(refunded.status).toBe('success');
    expect(gateway.refunds).toEqual([{ reference: charged.reference, amount: 600 }]);
  });

  it('returns the gateway failure when a refund is not accepted', async () => {
    const outcome = await new UpiPaymentMethod(gateway).refund('unknown-ref', 600);

    expect(outcome.status).toBe('failure');
  });

  it.each([0, -1, Number.NaN])('rejects a refund of %s', async (amount) => {
    await expect(new UpiPaymentMethod(gateway).refund('mock-txn-1', amount)).rejects.toThrow(InvalidPaymentError);
    expect(gateway.refunds).toHaveLength(0);
  });
});
