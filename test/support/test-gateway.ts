import { MockPaymentGateway } from '../../src/payment/gateway/mock-payment-gateway';
import {
  ChargeRequest,
  GatewayOutcome,
  PaymentGateway,
  RefundRequest,
} from '../../src/payment/gateway/payment-gateway';

/**
 * Wraps the mock gateway so a test can make things go wrong at a chosen moment:
 * run code while the charge is still "in the gateway", refuse refunds, or fail the call completely.
 */
export class TestGateway implements PaymentGateway {
  declining = false;
  failRefunds = false;
  chargeError: Error | undefined;
  duringCharge: (() => Promise<void>) | undefined;
  private readonly inner = new MockPaymentGateway(() => this.declining);

  get charges(): readonly ChargeRequest[] {
    return this.inner.charges;
  }

  get refunds(): readonly RefundRequest[] {
    return this.inner.refunds;
  }

  async charge(request: ChargeRequest): Promise<GatewayOutcome> {
    if (this.chargeError) throw this.chargeError;
    const outcome = await this.inner.charge(request);
    await this.duringCharge?.();
    return outcome;
  }

  async refund(request: RefundRequest): Promise<GatewayOutcome> {
    if (this.failRefunds) {
      this.inner.refunds.push(request);
      return { status: 'failure', reason: 'refund refused' };
    }
    return this.inner.refund(request);
  }
}
