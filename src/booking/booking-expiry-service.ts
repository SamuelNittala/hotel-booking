import { BookingRepository } from './booking-repository';
import { BookingService } from './booking-service';
import { InvalidBookingError, InvalidBookingTransitionError } from './errors';

const DEFAULT_PAYMENT_WINDOW_MINUTES = 15;
const MS_PER_MINUTE = 60 * 1000;

export type ExpirySweepResult = {
  expired: readonly number[];
  skipped: readonly number[];
  failed: readonly { bookingId: number; error: unknown }[];
};

export class BookingExpiryService {
  private readonly paymentWindowMs: number;

  constructor(
    private readonly bookings: BookingRepository,
    private readonly bookingService: BookingService,
    paymentWindowMinutes: number = DEFAULT_PAYMENT_WINDOW_MINUTES,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (!Number.isFinite(paymentWindowMinutes) || paymentWindowMinutes <= 0) {
      throw new InvalidBookingError(`paymentWindowMinutes must be more than zero (got ${paymentWindowMinutes})`);
    }
    this.paymentWindowMs = paymentWindowMinutes * MS_PER_MINUTE;
  }

  async expireOverdue(): Promise<ExpirySweepResult> {
    const cutoff = new Date(this.now().getTime() - this.paymentWindowMs);
    const overdue = await this.bookings.findPendingCreatedBefore(cutoff);

    const expired: number[] = [];
    const skipped: number[] = [];
    const failed: { bookingId: number; error: unknown }[] = [];

    for (const booking of overdue) {
      try {
        await this.bookingService.expire(booking.id);
        expired.push(booking.id);
      } catch (error) {
        if (error instanceof InvalidBookingTransitionError) {
          skipped.push(booking.id); // someone paid or cancelled it after the list was read
        } else {
          failed.push({ bookingId: booking.id, error });
        }
      }
    }
    return { expired, skipped, failed };
  }
}
