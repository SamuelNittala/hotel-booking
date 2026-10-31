import { DomainError } from '../shared/errors';
import { BookingStatus } from './booking-status';

export class InvalidBookingError extends DomainError {}

export class InvalidBookingTransitionError extends DomainError {
  constructor(bookingId: number, from: BookingStatus, to: BookingStatus) {
    super(`Booking ${bookingId} cannot move from ${from} to ${to}`);
  }
}
