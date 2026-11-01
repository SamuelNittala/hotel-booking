import { DomainError } from '../shared/errors';

export class InvalidRefundPolicyError extends DomainError {}

/** A policy answered with an amount that cannot be refunded (negative, not a number, or more than was paid). */
export class InvalidRefundAmountError extends DomainError {
  constructor(bookingId: number, amount: number, paidAmount: number) {
    super(`Refund of ${amount} for booking ${bookingId} is not between 0 and the ${paidAmount} paid`);
  }
}

/** A confirmed booking should always have a successful payment. This means the records disagree. */
export class NoSuccessfulPaymentError extends DomainError {
  constructor(bookingId: number) {
    super(`Booking ${bookingId} is confirmed but has no successful payment`);
  }
}
