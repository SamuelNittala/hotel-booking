import { describe, expect, it } from 'vitest';
import { InvalidPaymentError, UnsupportedPaymentMethodError } from '../../../src/payment/errors';
import { GatewayPaymentMethod } from '../../../src/payment/method/gateway-payment-method';
import { UpiPaymentMethod } from '../../../src/payment/method/upi-payment-method';
import { WalletPaymentMethod } from '../../../src/payment/method/wallet-payment-method';
import { MockPaymentGateway } from '../../../src/payment/gateway/mock-payment-gateway';
import { PayerDetails } from '../../../src/payment/method/payment-method';
import { PaymentMethodRegistry } from '../../../src/payment/method/payment-method-registry';

const gateway = new MockPaymentGateway();

describe('PaymentMethodRegistry', () => {
  it('finds a registered method by name', () => {
    const upi = new UpiPaymentMethod(gateway);
    const registry = new PaymentMethodRegistry([upi, new WalletPaymentMethod(gateway)]);

    expect(registry.get('UPI')).toBe(upi);
  });

  it('throws UnsupportedPaymentMethodError for an unknown name', () => {
    const registry = new PaymentMethodRegistry([new UpiPaymentMethod(gateway)]);

    expect(() => registry.get('CRYPTO')).toThrow(UnsupportedPaymentMethodError);
  });

  it('is case sensitive', () => {
    const registry = new PaymentMethodRegistry([new UpiPaymentMethod(gateway)]);

    expect(() => registry.get('upi')).toThrow(UnsupportedPaymentMethodError);
  });

  it('refuses to register two methods with the same name', () => {
    const registry = new PaymentMethodRegistry([new UpiPaymentMethod(gateway)]);

    expect(() => registry.register(new UpiPaymentMethod(gateway))).toThrow(InvalidPaymentError);
  });

  it('starts empty when given no methods', () => {
    expect(() => new PaymentMethodRegistry().get('UPI')).toThrow(UnsupportedPaymentMethodError);
  });

  it('supports a brand new method with no change to existing code', async () => {
    class NetBankingPaymentMethod extends GatewayPaymentMethod {
      readonly name = 'NETBANKING';

      protected payerReference(details: PayerDetails): string {
        const bank = details['bank'];
        if (!bank) throw new InvalidPaymentError('bank is required');
        return `bank-${bank}`;
      }
    }
    const registry = new PaymentMethodRegistry([new UpiPaymentMethod(gateway)]);

    registry.register(new NetBankingPaymentMethod(gateway));
    const outcome = await registry.get('NETBANKING').charge(2000, { bank: 'hdfc' });

    expect(outcome.status).toBe('success');
  });
});
