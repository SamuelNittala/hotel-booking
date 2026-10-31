import { InvalidPaymentError, InvalidPaymentTransitionError } from './errors';
import { PaymentStatus } from './payment-status';

export type PaymentProps = {
  id: number;
  bookingId: number;
  amount: number;
  /** Name of the payment method used, e.g. 'UPI'. A plain string so new methods need no change here. */
  method: string;
};

/** Which status a payment may move to from each status. Anything not listed is illegal. */
const ALLOWED_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['success', 'failure', 'cancelled'],
  success: ['refunded'],
  failure: [],
  cancelled: [],
  refunded: [],
};

/**
 * One payment attempt for a booking. A booking can have several (one per retry).
 * It starts `pending` and only moves through `succeed`, `fail`, `cancel` and `refund`.
 * It does not call any gateway and does not know the booking's status; the services around it do that.
 */
export class Payment {
  readonly id: number;
  readonly bookingId: number;
  readonly amount: number;
  readonly method: string;

  private currentStatus: PaymentStatus = 'pending';
  private currentRefundedAmount = 0;
  private currentGatewayReference: string | undefined;

  private constructor(props: PaymentProps) {
    this.id = props.id;
    this.bookingId = props.bookingId;
    this.amount = props.amount;
    this.method = props.method;
  }

  static create(props: PaymentProps): Payment {
    if (!Number.isFinite(props.amount) || props.amount <= 0) {
      throw new InvalidPaymentError(`amount must be more than zero (got ${props.amount})`);
    }
    if (props.method.trim() === '') {
      throw new InvalidPaymentError('method must not be empty');
    }
    return new Payment(props);
  }

  get status(): PaymentStatus {
    return this.currentStatus;
  }

  get refundedAmount(): number {
    return this.currentRefundedAmount;
  }

  get gatewayReference(): string | undefined {
    return this.currentGatewayReference;
  }

  succeed(gatewayReference: string): void {
    this.assertCanMoveTo('success');
    if (gatewayReference.trim() === '') {
      throw new InvalidPaymentError('gatewayReference must not be empty');
    }
    this.currentGatewayReference = gatewayReference;
    this.currentStatus = 'success';
  }

  fail(): void {
    this.transitionTo('failure');
  }

  cancel(): void {
    this.transitionTo('cancelled');
  }

  refund(refundAmount: number): void {
    this.assertCanRefund(refundAmount);
    this.currentRefundedAmount = refundAmount;
    this.currentStatus = 'refunded';
  }

  assertCanRefund(refundAmount: number): void {
    this.assertCanMoveTo('refunded');
    if (!Number.isFinite(refundAmount) || refundAmount <= 0 || refundAmount > this.amount) {
      throw new InvalidPaymentError(`refund must be more than zero and at most ${this.amount} (got ${refundAmount})`);
    }
  }

  private transitionTo(next: PaymentStatus): void {
    this.assertCanMoveTo(next);
    this.currentStatus = next;
  }

  private assertCanMoveTo(next: PaymentStatus): void {
    if (!ALLOWED_TRANSITIONS[this.currentStatus].includes(next)) {
      throw new InvalidPaymentTransitionError(this.id, this.currentStatus, next);
    }
  }
}
