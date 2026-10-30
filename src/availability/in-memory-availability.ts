import { DateRange } from '../shared/date-range';
import { Availability, Reservation } from './availability';

export class InMemoryAvailability implements Availability {
  private readonly reservationsByRoom = new Map<number, Reservation[]>();

  async check(dateRange: DateRange, roomId: number): Promise<boolean> {
    // TODO
    throw new Error('Not implemented');
  }

  async reserve(dateRange: DateRange, roomId: number, bookingId: number): Promise<Reservation> {
    // TODO: check and add must happen with no await in between
    throw new Error('Not implemented');
  }

  async release(bookingId: number): Promise<boolean> {
    // TODO
    throw new Error('Not implemented');
  }
}
