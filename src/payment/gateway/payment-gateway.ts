export type ChargeRequest = {
  /** Name of the payment method, e.g. 'UPI'. */
  method: string;
  amount: number;
  /** Identifies who is paying (UPI id, wallet id, masked card), as the gateway needs it. */
  payer: string;
};

export type RefundRequest = {
  /** The reference the gateway returned when it took the money. */
  reference: string;
  amount: number;
};

/** What the gateway answered. A decline is an expected outcome, so it is returned, not thrown. */
export type GatewayOutcome =
  | { status: 'success'; reference: string }
  | { status: 'failure'; reason: string };

/**
 * The third-party payment provider, behind our own contract so a real one can replace the mock.
 * A decline comes back as a `failure` outcome. An outage or timeout would reject the promise.
 */
export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<GatewayOutcome>;
  refund(request: RefundRequest): Promise<GatewayOutcome>;
}
