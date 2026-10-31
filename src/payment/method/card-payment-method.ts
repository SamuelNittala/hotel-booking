import { InvalidPaymentError } from '../errors';
import { GatewayPaymentMethod } from './gateway-payment-method';
import { PayerDetails } from './payment-method';

const CARD_NUMBER = /^\d{13,19}$/;

export class CardPaymentMethod extends GatewayPaymentMethod {
  readonly name = 'CARD';

  /** Spaces and dashes are allowed in the input. Only the last four digits are passed on, never the full number. */
  protected payerReference(details: PayerDetails): string {
    const digits = (details['cardNumber'] ?? '').replace(/[\s-]/g, '');
    if (!CARD_NUMBER.test(digits)) {
      throw new InvalidPaymentError('cardNumber must be 13 to 19 digits');
    }
    return `card-ending-${digits.slice(-4)}`;
  }
}
