import { Booking } from './booking';
import { BookingRepository } from './booking-repository';

/** Keeps the booking objects themselves in a map. */
export class InMemoryBookingRepository implements BookingRepository {
  private readonly bookingsById = new Map<number, Booking>();

  async save(booking: Booking): Promise<void> {
    this.bookingsById.set(booking.id, booking);
  }

  async findById(id: number): Promise<Booking | undefined> {
    return this.bookingsById.get(id);
  }

  async findByGuestId(guestId: number): Promise<readonly Booking[]> {
    return [...this.bookingsById.values()].filter((booking) => booking.guestId === guestId);
  }

  async findPendingCreatedBefore(cutoff: Date): Promise<readonly Booking[]> {
    return [...this.bookingsById.values()].filter(
      (booking) => booking.status === 'pending' && booking.createdAt.getTime() < cutoff.getTime(),
    );
  }
}
