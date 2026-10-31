import { InvalidPaymentError } from '../errors';
import { GatewayPaymentMethod } from './gateway-payment-method';
import { PayerDetails } from './payment-method';

export class WalletPaymentMethod extends GatewayPaymentMethod {
  readonly name = 'WALLET';

  protected payerReference(details: PayerDetails): string {
    const walletId = details['walletId']?.trim() ?? '';
    if (walletId === '') {
      throw new InvalidPaymentError('walletId is required');
    }
    return walletId;
  }
}
