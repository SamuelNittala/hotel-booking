import { Booking } from "../booking/booking";
import { BookingRepository } from "../booking/booking-repository";
import { BookingService } from "../booking/booking-service";
import { BookingNotFoundError } from "../booking/errors";
import { RefundFailedError } from "../payment/errors";
import { Payment } from "../payment/payment";
import { PaymentRepository } from "../payment/payment-repository";
import { PaymentService } from "../payment/payment-service";
import { InvalidRefundAmountError, NoSuccessfulPaymentError } from "./errors";
import { RefundPolicy } from "./refund-policy";

export type CancellationResult = {
  booking: Booking;
  refundAmount: number;
  refundStatus: "none" | "refunded" | "failed";
  paymentId?: number;
};

export class CancellationService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly payments: PaymentRepository,
    private readonly bookingService: BookingService,
    private readonly paymentService: PaymentService,
    private readonly policy: RefundPolicy,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async cancel(bookingId: number): Promise<CancellationResult> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    const payment =
      booking.status === "confirmed"
        ? await this.successfulPayment(booking)
        : undefined;
    const refundAmount = payment ? this.refundAmountFor(booking, payment) : 0;

    const cancelled = await this.bookingService.cancel(booking.id);

    if (!payment || refundAmount === 0) {
      return { booking: cancelled, refundAmount: 0, refundStatus: "none" };
    }
    try {
      await this.paymentService.refund(payment.id, refundAmount);
    } catch (error) {
      if (error instanceof RefundFailedError) {
        return {
          booking: cancelled,
          refundAmount,
          refundStatus: "failed",
          paymentId: payment.id,
        };
      }
      throw error;
    }
    return {
      booking: cancelled,
      refundAmount,
      refundStatus: "refunded",
      paymentId: payment.id,
    };
  }

  private async successfulPayment(booking: Booking): Promise<Payment> {
    const attempts = await this.payments.findByBookingId(booking.id);
    const payment = attempts.find((attempt) => attempt.status === "success");
    if (!payment) {
      throw new NoSuccessfulPaymentError(booking.id);
    }
    return payment;
  }

  private refundAmountFor(booking: Booking, payment: Payment): number {
    const amount = this.policy.refundFor({
      booking,
      paidAmount: payment.amount,
      cancelledAt: this.now(),
    });
    if (!Number.isFinite(amount) || amount < 0 || amount > payment.amount) {
      throw new InvalidRefundAmountError(booking.id, amount, payment.amount);
    }
    return amount;
  }
}
