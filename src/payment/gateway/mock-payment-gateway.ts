import { ChargeRequest, GatewayOutcome, PaymentGateway, RefundRequest } from './payment-gateway';

/**
 * A stand-in for a real payment provider. Charges succeed unless `shouldDecline` says otherwise.
 * It remembers every request so tests can check what was sent.
 */
export class MockPaymentGateway implements PaymentGateway {
  readonly charges: ChargeRequest[] = [];
  readonly refunds: RefundRequest[] = [];

  private readonly issuedReferences = new Set<string>();
  private counter = 0;

  constructor(private readonly shouldDecline: (request: ChargeRequest) => boolean = () => false) {}

  async charge(request: ChargeRequest): Promise<GatewayOutcome> {
    this.charges.push(request);
    if (this.shouldDecline(request)) {
      return { status: 'failure', reason: 'Declined by mock gateway' };
    }
    const reference = `mock-txn-${++this.counter}`;
    this.issuedReferences.add(reference);
    return { status: 'success', reference };
  }

  async refund(request: RefundRequest): Promise<GatewayOutcome> {
    this.refunds.push(request);
    if (!this.issuedReferences.has(request.reference)) {
      return { status: 'failure', reason: `Unknown transaction ${request.reference}` };
    }
    return { status: 'success', reference: `mock-refund-${++this.counter}` };
  }
}
