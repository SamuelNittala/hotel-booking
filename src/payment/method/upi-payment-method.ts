import { InvalidPaymentError } from '../errors';
import { GatewayPaymentMethod } from './gateway-payment-method';
import { PayerDetails } from './payment-method';

const UPI_ID = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;

export class UpiPaymentMethod extends GatewayPaymentMethod {
  readonly name = 'UPI';

  protected payerReference(details: PayerDetails): string {
    const upiId = details['upiId']?.trim() ?? '';
    if (!UPI_ID.test(upiId)) {
      throw new InvalidPaymentError(`upiId must look like name@bank (got '${upiId}')`);
    }
    return upiId;
  }
}
