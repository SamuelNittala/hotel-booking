import { GatewayOutcome } from '../gateway/payment-gateway';

/** What the guest supplies for a method, e.g. `{ upiId: 'asha@okbank' }`. Each method knows which keys it needs. */
export type PayerDetails = Readonly<Record<string, string>>;

/**
 * One way of paying (UPI, wallet, card, ...). The payment service only knows this contract,
 * so a new method is a new class that is registered, with no change to existing code.
 * `charge` and `refund` throw `InvalidPaymentError` for bad input and return a `failure`
 * outcome when the provider declines.
 */
export interface PaymentMethod {
  /** The name stored on `Payment.method` and used to look the method up, e.g. 'UPI'. */
  readonly name: string;
  charge(amount: number, details: PayerDetails): Promise<GatewayOutcome>;
  refund(reference: string, amount: number): Promise<GatewayOutcome>;
}
