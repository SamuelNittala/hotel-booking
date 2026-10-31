import { DateRange } from '../shared/date-range';
import { DomainError } from '../shared/errors';
import { BookingStatus } from './booking-status';

export class InvalidBookingError extends DomainError {}

export class BookingNotFoundError extends DomainError {
  constructor(bookingId: number) {
    super(`Booking ${bookingId} does not exist`);
  }
}

export class StayTooShortError extends DomainError {
  constructor(propertyId: number, minNights: number, nights: number) {
    super(`Property ${propertyId} needs a stay of at least ${minNights} night(s) (got ${nights})`);
  }
}

/** The property has no room of the requested type that can hold the guests. */
export class NoMatchingRoomError extends DomainError {
  constructor(propertyId: number, roomType: string, guestCount: number) {
    super(`Property ${propertyId} has no '${roomType}' room for ${guestCount} guest(s)`);
  }
}

/** Matching rooms exist, but every one is taken for some of the dates. */
export class NoRoomAvailableError extends DomainError {
  constructor(propertyId: number, roomType: string, dateRange: DateRange) {
    super(`Property ${propertyId} has no '${roomType}' room free from ${dateRange.fromDate} to ${dateRange.toDate}`);
  }
}

export class InvalidBookingTransitionError extends DomainError {
  constructor(bookingId: number, from: BookingStatus, to: BookingStatus) {
    super(`Booking ${bookingId} cannot move from ${from} to ${to}`);
  }
}
