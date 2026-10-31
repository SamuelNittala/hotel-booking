import { Payment } from './payment';

/** Stores payment attempts. Lookups that find nothing return `undefined` or an empty list, they do not throw. */
export interface PaymentRepository {
  /**
   * Inserts the payment, or replaces the stored one with the same id.
   * Always call it after a status change, so a database-backed version behaves the same way.
   */
  save(payment: Payment): Promise<void>;
  findById(id: number): Promise<Payment | undefined>;
  /** Every attempt made for the booking, whatever its status. A booking has one per try. */
  findByBookingId(bookingId: number): Promise<readonly Payment[]>;
}
