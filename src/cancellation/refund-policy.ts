import { Booking } from '../booking/booking';

export type CancellationContext = {
  booking: Booking;
  paidAmount: number;
  cancelledAt: Date;
};

export interface RefundPolicy {
  refundFor(context: CancellationContext): number;
}
