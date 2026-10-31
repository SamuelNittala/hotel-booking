import { Booking } from './booking';

/** Stores bookings. Lookups that find nothing return `undefined` or an empty list, they do not throw. */
export interface BookingRepository {
  /**
   * Inserts the booking, or replaces the stored one with the same id.
   * Always call it after a status change, so a database-backed version behaves the same way.
   */
  save(booking: Booking): Promise<void>;
  findById(id: number): Promise<Booking | undefined>;
  findByGuestId(guestId: number): Promise<readonly Booking[]>;
  /** Pending bookings created strictly before `cutoff`: the ones that have waited too long for payment. */
  findPendingCreatedBefore(cutoff: Date): Promise<readonly Booking[]>;
}
