import { BookingRepository } from '../booking/booking-repository';
import { BookingService } from '../booking/booking-service';
import { BookingNotFoundError, InvalidBookingTransitionError } from '../booking/errors';
import { IdGenerator } from '../shared/id-generator';
import {
  BookingNotPayableError,
  InvalidPaymentError,
  PaymentInProgressError,
  PaymentNotFoundError,
  RefundFailedError,
} from './errors';
import { Payment } from './payment';
import { PaymentRepository } from './payment-repository';
import { GatewayOutcome } from './gateway/payment-gateway';
import { PayerDetails, PaymentMethod } from './method/payment-method';
import { PaymentMethodRegistry } from './method/payment-method-registry';

export type PayRequest = {
  bookingId: number;
  method: string;
  details: PayerDetails;
};

const DEFAULT_MAX_FAILED_ATTEMPTS = 3;

export class PaymentService {
  private readonly bookingsBeingPaid = new Set<number>();
  private readonly paymentsBeingRefunded = new Set<number>();

  constructor(
    private readonly payments: PaymentRepository,
    private readonly bookings: BookingRepository,
    private readonly bookingService: BookingService,
    private readonly methods: PaymentMethodRegistry,
    private readonly ids: IdGenerator,

    private readonly maxFailedAttempts: number = DEFAULT_MAX_FAILED_ATTEMPTS,
  ) {
    if (!Number.isInteger(maxFailedAttempts) || maxFailedAttempts < 1) {
      throw new InvalidPaymentError(`maxFailedAttempts must be a whole number of at least 1 (got ${maxFailedAttempts})`);
    }
  }

  pay(request: PayRequest): Promise<Payment> {
    return this.exclusively(this.bookingsBeingPaid, 'booking', request.bookingId, () => this.attempt(request));
  }

  refund(paymentId: number, amount?: number): Promise<Payment> {
    return this.exclusively(this.paymentsBeingRefunded, 'payment', paymentId, async () => {
      const payment = await this.payments.findById(paymentId);
      if (!payment) {
        throw new PaymentNotFoundError(paymentId);
      }
      await this.refundPayment(payment, amount ?? payment.amount);
      return payment;
    });
  }

  private async attempt(request: PayRequest): Promise<Payment> {
    const booking = await this.bookings.findById(request.bookingId);
    if (!booking) {
      throw new BookingNotFoundError(request.bookingId);
    }
    if (booking.status !== 'pending') {
      throw new BookingNotPayableError(booking.id, booking.status);
    }
    const method = this.methods.get(request.method);

    const payment = Payment.create({
      id: this.ids.next(),
      bookingId: booking.id,
      amount: booking.totalAmount,
      method: method.name,
    });
    await this.payments.save(payment);

    const outcome = await this.charge(payment, method, request.details);
    if (outcome.status === 'failure') {
      return this.recordDecline(payment);
    }
    return this.recordSuccess(payment, outcome.reference);
  }

  private async charge(payment: Payment, method: PaymentMethod, details: PayerDetails): Promise<GatewayOutcome> {
    try {
      return await method.charge(payment.amount, details);
    } catch (error) {
      payment.cancel();
      await this.payments.save(payment);
      throw error;
    }
  }

  private async recordDecline(payment: Payment): Promise<Payment> {
    payment.fail();
    await this.payments.save(payment);

    const attempts = await this.payments.findByBookingId(payment.bookingId);
    const declined = attempts.filter((attempt) => attempt.status === 'failure').length;
    if (declined >= this.maxFailedAttempts) {
      await this.expireIfStillPending(payment.bookingId);
    }
    return payment;
  }

  private async recordSuccess(payment: Payment, reference: string): Promise<Payment> {
    payment.succeed(reference);
    await this.payments.save(payment);

    try {
      await this.bookingService.confirm(payment.bookingId);
    } catch (error) {
      if (!(error instanceof InvalidBookingTransitionError)) {
        throw error;
      }
      await this.refundPayment(payment, payment.amount);
    }
    return payment;
  }

  private async expireIfStillPending(bookingId: number): Promise<void> {
    try {
      await this.bookingService.expire(bookingId);
    } catch (error) {
      if (!(error instanceof InvalidBookingTransitionError)) {
        throw error;
      }
    }
  }

  private async refundPayment(payment: Payment, amount: number): Promise<void> {
    payment.assertCanRefund(amount);
    const reference = payment.gatewayReference;
    if (reference === undefined) {
      throw new InvalidPaymentError(`Payment ${payment.id} has no gateway reference to refund`);
    }

    const outcome = await this.methods.get(payment.method).refund(reference, amount);
    if (outcome.status === 'failure') {
      throw new RefundFailedError(payment.id, outcome.reason);
    }

    payment.refund(amount);
    await this.payments.save(payment);
  }

  private async exclusively<T>(
    running: Set<number>,
    what: string,
    id: number,
    work: () => Promise<T>,
  ): Promise<T> {
    if (running.has(id)) {
      throw new PaymentInProgressError(what, id);
    }
    running.add(id);
    try {
      return await work();
    } finally {
      running.delete(id);
    }
  }
}
