import { Payment } from './payment';
import { PaymentRepository } from './payment-repository';

/** Keeps the payment objects themselves in a map. */
export class InMemoryPaymentRepository implements PaymentRepository {
  private readonly paymentsById = new Map<number, Payment>();

  async save(payment: Payment): Promise<void> {
    this.paymentsById.set(payment.id, payment);
  }

  async findById(id: number): Promise<Payment | undefined> {
    return this.paymentsById.get(id);
  }

  async findByBookingId(bookingId: number): Promise<readonly Payment[]> {
    return [...this.paymentsById.values()].filter((payment) => payment.bookingId === bookingId);
  }
}
