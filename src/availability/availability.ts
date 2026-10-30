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

export interface Availability {
  check(dateRange: DateRange, roomId: number): Promise<boolean>;
  reserve(dateRange: DateRange, roomId: number, bookingId: number): Promise<Reservation>;
  release(bookingId: number): Promise<boolean>;
}
