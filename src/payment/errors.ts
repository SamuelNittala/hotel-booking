import { DomainError } from '../shared/errors';
import { PaymentStatus } from './payment-status';

export class InvalidPaymentError extends DomainError {}

export class UnsupportedPaymentMethodError extends DomainError {
  constructor(methodName: string) {
    super(`Payment method '${methodName}' is not supported`);
  }
}

export class InvalidPaymentTransitionError extends DomainError {
  constructor(paymentId: number, from: PaymentStatus, to: PaymentStatus) {
    super(`Payment ${paymentId} cannot move from ${from} to ${to}`);
  }
}
