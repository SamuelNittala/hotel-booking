import { DateRange } from '../shared/date-range';
import { DomainError } from '../shared/errors';

export type Reservation = {
  bookingId: number;
  roomId: number;
  dateRange: DateRange;
};

export class RoomUnavailableError extends DomainError {
  constructor(roomId: number, dateRange: DateRange) {
    super(`Room ${roomId} is not available from ${dateRange.fromDate} to ${dateRange.toDate}`);
  }
}

export class BookingAlreadyReservedError extends DomainError {
  constructor(bookingId: number) {
    super(`Booking ${bookingId} already holds a reservation`);
  }
}

export interface Availability {
  check(dateRange: DateRange, roomId: number): Promise<boolean>;
  /*
    - Throws `BookingAlreadyReservedError` if the booking id already holds a reservation
    - Throws `RoomUnavailableError` if the room is taken for any of the dates
    - Checks and writes in one step, so it never trusts an earlier `check`
  */
  reserve(dateRange: DateRange, roomId: number, bookingId: number): Promise<Reservation>;
  /*
    - Releasing a booking twice is fine (safe-to-repeat)
    - Returns `false` when the booking id is unknown (fine for now)
    - One booking holds one reservation
  */
  release(bookingId: number): Promise<boolean>;
}
