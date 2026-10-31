import { InvalidPaymentError } from '../errors';
import { GatewayOutcome, PaymentGateway } from '../gateway/payment-gateway';
import { PayerDetails, PaymentMethod } from './payment-method';

/**
 * A payment method that goes through a `PaymentGateway`. A new method only has to say its `name`
 * and how to read and validate its own details in `payerReference`.
 */
export abstract class GatewayPaymentMethod implements PaymentMethod {
  abstract readonly name: string;

  constructor(private readonly gateway: PaymentGateway) {}

  /** Validates the details this method needs and returns how the gateway should identify the payer. */
  protected abstract payerReference(details: PayerDetails): string;

  async charge(amount: number, details: PayerDetails): Promise<GatewayOutcome> {
    this.assertPositive(amount);
    const payer = this.payerReference(details);
    return this.gateway.charge({ method: this.name, amount, payer });
  }

  async refund(reference: string, amount: number): Promise<GatewayOutcome> {
    this.assertPositive(amount);
    return this.gateway.refund({ reference, amount });
  }

  private assertPositive(amount: number): void {
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new InvalidPaymentError(`amount must be more than zero (got ${amount})`);
    }
  }
}
