import { BookingStatus } from '../booking/booking-status';
import { DomainError } from '../shared/errors';
import { PaymentStatus } from './payment-status';

export class InvalidPaymentError extends DomainError {}

export class UnsupportedPaymentMethodError extends DomainError {
  constructor(methodName: string) {
    super(`Payment method '${methodName}' is not supported`);
  }
}

export class PaymentNotFoundError extends DomainError {
  constructor(paymentId: number) {
    super(`Payment ${paymentId} does not exist`);
  }
}

/** Only a `pending` booking can be paid for. */
export class BookingNotPayableError extends DomainError {
  constructor(bookingId: number, status: BookingStatus) {
    super(`Booking ${bookingId} is ${status} and cannot be paid for`);
  }
}

/** Another attempt for the same booking (or another refund for the same payment) is still running. */
export class PaymentInProgressError extends DomainError {
  constructor(what: string, id: number) {
    super(`Another payment operation is already running for ${what} ${id}`);
  }
}

export class RefundFailedError extends DomainError {
  constructor(paymentId: number, reason: string) {
    super(`Refund of payment ${paymentId} failed: ${reason}`);
  }
}

export class InvalidPaymentTransitionError extends DomainError {
  constructor(paymentId: number, from: PaymentStatus, to: PaymentStatus) {
    super(`Payment ${paymentId} cannot move from ${from} to ${to}`);
  }
}
