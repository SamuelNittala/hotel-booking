import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryAvailability } from '../../src/availability/in-memory-availability';
import { BookingService } from '../../src/booking/booking-service';
import { BookingNotFoundError } from '../../src/booking/errors';
import { InMemoryBookingRepository } from '../../src/booking/in-memory-booking-repository';
import {
  BookingNotPayableError,
  InvalidPaymentError,
  InvalidPaymentTransitionError,
  PaymentInProgressError,
  PaymentNotFoundError,
  RefundFailedError,
  UnsupportedPaymentMethodError,
} from '../../src/payment/errors';
import { InMemoryPaymentRepository } from '../../src/payment/in-memory-payment-repository';
import { CardPaymentMethod } from '../../src/payment/method/card-payment-method';
import { PayerDetails } from '../../src/payment/method/payment-method';
import { PaymentMethodRegistry } from '../../src/payment/method/payment-method-registry';
import { UpiPaymentMethod } from '../../src/payment/method/upi-payment-method';
import { WalletPaymentMethod } from '../../src/payment/method/wallet-payment-method';
import { PaymentService } from '../../src/payment/payment-service';
import { InMemoryPropertyRepository } from '../../src/property/in-memory-property-repository';
import { Property } from '../../src/property/property';
import { PropertyLocation } from '../../src/property/property-location';
import { Room } from '../../src/property/room';
import { DateRange } from '../../src/shared/date-range';
import { SequentialIdGenerator } from '../../src/shared/sequential-id-generator';
import { TestGateway } from '../support/test-gateway';

const stay = DateRange.of('2026-11-10', '2026-11-12'); // 2 nights at 4000 = 8000
const upi: PayerDetails = { upiId: 'asha@okbank' };

describe('PaymentService', () => {
  let gateway: TestGateway;
  let payments: InMemoryPaymentRepository;
  let bookings: InMemoryBookingRepository;
  let availability: InMemoryAvailability;
  let bookingService: BookingService;
  let service: PaymentService;

  beforeEach(async () => {
    gateway = new TestGateway();
    payments = new InMemoryPaymentRepository();
    bookings = new InMemoryBookingRepository();
    availability = new InMemoryAvailability();
    const properties = new InMemoryPropertyRepository();
    await properties.save(
      Property.create({
        id: 1,
        name: 'Lakeview Inn',
        ownerId: 7,
        location: PropertyLocation.of({ city: 'Bengaluru', locality: 'Indiranagar', latitude: 12.97, longitude: 77.64 }),
        amenities: ['wifi'],
        starRating: 4,
        rooms: [Room.create({ id: 101, type: 'queen', capacity: 2, pricePerNight: 4000 })],
      }),
    );
    bookingService = new BookingService(properties, bookings, availability, new SequentialIdGenerator());
    service = newService();
  });

  const newService = (maxFailedAttempts?: number) =>
    new PaymentService(
      payments,
      bookings,
      bookingService,
      new PaymentMethodRegistry([
        new UpiPaymentMethod(gateway),
        new WalletPaymentMethod(gateway),
        new CardPaymentMethod(gateway),
      ]),
      new SequentialIdGenerator(),
      maxFailedAttempts,
    );

  const bookRoom = (dateRange = stay) =>
    bookingService.book({ guestId: 50, propertyId: 1, roomType: 'queen', guestCount: 2, dateRange });

  const statusOf = async (bookingId: number) => (await bookings.findById(bookingId))?.status;

  describe('a successful payment', () => {
    it('pays the full booking amount and keeps the gateway reference', async () => {
      const booking = await bookRoom();

      const payment = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(payment.status).toBe('success');
      expect(payment.amount).toBe(8000);
      expect(payment.method).toBe('UPI');
      expect(payment.bookingId).toBe(booking.id);
      expect(payment.gatewayReference).toBeDefined();
    });

    it('confirms the booking and keeps its dates', async () => {
      const booking = await bookRoom();

      await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(await statusOf(booking.id)).toBe('confirmed');
      expect(await availability.check(stay, 101)).toBe(false);
    });

    it('saves the payment', async () => {
      const booking = await bookRoom();

      const payment = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(await payments.findByBookingId(booking.id)).toEqual([payment]);
    });

    it('sends the amount and the payer to the gateway once', async () => {
      const booking = await bookRoom();

      await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(gateway.charges).toEqual([{ method: 'UPI', amount: 8000, payer: 'asha@okbank' }]);
    });

    it.each<[string, PayerDetails]>([
      ['UPI', upi],
      ['WALLET', { walletId: 'wallet-1' }],
      ['CARD', { cardNumber: '4111 1111 1111 1111' }],
    ])('works with %s', async (method, details) => {
      const booking = await bookRoom();

      const payment = await service.pay({ bookingId: booking.id, method, details });

      expect(payment.method).toBe(method);
      expect(await statusOf(booking.id)).toBe('confirmed');
    });
  });

  describe('a declined payment', () => {
    it('returns a failed payment and leaves the booking pending with its dates held', async () => {
      const booking = await bookRoom();
      gateway.declining = true;

      const payment = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(payment.status).toBe('failure');
      expect(await statusOf(booking.id)).toBe('pending');
      expect(await availability.check(stay, 101)).toBe(false);
    });

    it('lets the guest try again and succeed, keeping both attempts', async () => {
      const booking = await bookRoom();
      gateway.declining = true;
      const first = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });
      gateway.declining = false;

      const second = await service.pay({ bookingId: booking.id, method: 'WALLET', details: { walletId: 'w-1' } });

      expect(second.id).not.toBe(first.id);
      expect(second.status).toBe('success');
      expect(first.status).toBe('failure');
      expect(await statusOf(booking.id)).toBe('confirmed');
      expect(await payments.findByBookingId(booking.id)).toHaveLength(2);
    });

    it('keeps the booking pending until the limit is reached', async () => {
      const booking = await bookRoom();
      gateway.declining = true;

      await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });
      await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(await statusOf(booking.id)).toBe('pending');
    });

    it('expires the booking and frees its dates on the third decline', async () => {
      const booking = await bookRoom();
      gateway.declining = true;

      await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });
      await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });
      await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(await statusOf(booking.id)).toBe('expired');
      expect(await availability.check(stay, 101)).toBe(true);
    });

    it('refuses further attempts once the booking has expired', async () => {
      const booking = await bookRoom();
      gateway.declining = true;
      for (let attempt = 0; attempt < 3; attempt++) {
        await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });
      }
      gateway.declining = false;

      await expect(service.pay({ bookingId: booking.id, method: 'UPI', details: upi })).rejects.toThrow(
        BookingNotPayableError,
      );
    });

    it('uses the limit it was given', async () => {
      const strict = newService(1);
      const booking = await bookRoom();
      gateway.declining = true;

      await strict.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(await statusOf(booking.id)).toBe('expired');
    });

    it('does not count abandoned attempts towards the limit', async () => {
      const booking = await bookRoom();
      const badDetails = { upiId: 'not-a-upi-id' };

      for (let attempt = 0; attempt < 4; attempt++) {
        await expect(service.pay({ bookingId: booking.id, method: 'UPI', details: badDetails })).rejects.toThrow(
          InvalidPaymentError,
        );
      }

      expect(await statusOf(booking.id)).toBe('pending');
    });

    it('rejects a limit that is not a whole number of at least 1', () => {
      expect(() => newService(0)).toThrow(InvalidPaymentError);
      expect(() => newService(1.5)).toThrow(InvalidPaymentError);
    });
  });

  describe('a payment that cannot be started', () => {
    it('throws for an unknown booking', async () => {
      await expect(service.pay({ bookingId: 999, method: 'UPI', details: upi })).rejects.toThrow(BookingNotFoundError);
    });

    it.each(['confirmed', 'cancelled', 'expired'] as const)('refuses a %s booking and charges nothing', async (status) => {
      const booking = await bookRoom();
      if (status === 'confirmed') await bookingService.confirm(booking.id);
      if (status === 'cancelled') await bookingService.cancel(booking.id);
      if (status === 'expired') await bookingService.expire(booking.id);

      await expect(service.pay({ bookingId: booking.id, method: 'UPI', details: upi })).rejects.toThrow(
        BookingNotPayableError,
      );

      expect(gateway.charges).toEqual([]);
      expect(await payments.findByBookingId(booking.id)).toEqual([]);
    });

    it('throws for an unsupported method and records no attempt', async () => {
      const booking = await bookRoom();

      await expect(service.pay({ bookingId: booking.id, method: 'CRYPTO', details: {} })).rejects.toThrow(
        UnsupportedPaymentMethodError,
      );

      expect(await payments.findByBookingId(booking.id)).toEqual([]);
      expect(gateway.charges).toEqual([]);
    });

    it('cancels the attempt when the payer details are invalid, charging nothing', async () => {
      const booking = await bookRoom();

      await expect(
        service.pay({ bookingId: booking.id, method: 'UPI', details: { upiId: 'nope' } }),
      ).rejects.toThrow(InvalidPaymentError);

      const [attempt] = await payments.findByBookingId(booking.id);
      expect(attempt?.status).toBe('cancelled');
      expect(gateway.charges).toEqual([]);
      expect(await statusOf(booking.id)).toBe('pending');
    });

    it('cancels the attempt and rethrows when the gateway call fails outright', async () => {
      const booking = await bookRoom();
      gateway.chargeError = new Error('gateway timeout');

      await expect(service.pay({ bookingId: booking.id, method: 'UPI', details: upi })).rejects.toThrow(
        'gateway timeout',
      );

      const [attempt] = await payments.findByBookingId(booking.id);
      expect(attempt?.status).toBe('cancelled');
      expect(await statusOf(booking.id)).toBe('pending');
    });
  });

  describe('two attempts at the same time', () => {
    it('lets one through and turns the other away, charging once', async () => {
      const booking = await bookRoom();

      const outcomes = await Promise.allSettled([
        service.pay({ bookingId: booking.id, method: 'UPI', details: upi }),
        service.pay({ bookingId: booking.id, method: 'UPI', details: upi }),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
      const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(PaymentInProgressError);
      expect(gateway.charges).toHaveLength(1);
      expect(await payments.findByBookingId(booking.id)).toHaveLength(1);
    });

    it('lets different bookings be paid at the same time', async () => {
      const first = await bookRoom();
      const second = await bookRoom(DateRange.of('2026-11-20', '2026-11-22'));

      const outcomes = await Promise.all([
        service.pay({ bookingId: first.id, method: 'UPI', details: upi }),
        service.pay({ bookingId: second.id, method: 'UPI', details: upi }),
      ]);

      expect(outcomes.map((payment) => payment.status)).toEqual(['success', 'success']);
    });

    it('accepts a new attempt once the earlier one has finished with an error', async () => {
      const booking = await bookRoom();
      await service.pay({ bookingId: booking.id, method: 'UPI', details: { upiId: 'nope' } }).catch(() => undefined);

      const payment = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(payment.status).toBe('success');
    });
  });

  describe('money arriving for a booking that is no longer waiting', () => {
    it('pays back in full when the booking was cancelled while the gateway was working', async () => {
      const booking = await bookRoom();
      gateway.duringCharge = async () => {
        await bookingService.cancel(booking.id);
      };

      const payment = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(payment.status).toBe('refunded');
      expect(payment.refundedAmount).toBe(8000);
      expect(gateway.refunds).toEqual([{ reference: payment.gatewayReference, amount: 8000 }]);
      expect(await statusOf(booking.id)).toBe('cancelled');
    });

    it('pays back in full when the booking expired while the gateway was working', async () => {
      const booking = await bookRoom();
      gateway.duringCharge = async () => {
        await bookingService.expire(booking.id);
      };

      const payment = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      expect(payment.status).toBe('refunded');
      expect(await statusOf(booking.id)).toBe('expired');
      expect(await availability.check(stay, 101)).toBe(true);
    });

    it('keeps the payment successful and reports the problem when that refund is refused', async () => {
      const booking = await bookRoom();
      gateway.failRefunds = true;
      gateway.duringCharge = async () => {
        await bookingService.cancel(booking.id);
      };

      await expect(service.pay({ bookingId: booking.id, method: 'UPI', details: upi })).rejects.toThrow(
        RefundFailedError,
      );

      const [stuck] = await payments.findByBookingId(booking.id);
      expect(stuck?.status).toBe('success');
    });
  });

  describe('refund', () => {
    const paidBooking = async () => {
      const booking = await bookRoom();
      const payment = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });
      return { booking, payment };
    };

    it('pays back the whole amount by default', async () => {
      const { payment } = await paidBooking();

      const refunded = await service.refund(payment.id);

      expect(refunded.status).toBe('refunded');
      expect(refunded.refundedAmount).toBe(8000);
      expect(gateway.refunds).toEqual([{ reference: payment.gatewayReference, amount: 8000 }]);
    });

    it('pays back part of the amount', async () => {
      const { payment } = await paidBooking();

      const refunded = await service.refund(payment.id, 3000);

      expect(refunded.refundedAmount).toBe(3000);
      expect(gateway.refunds[0]?.amount).toBe(3000);
    });

    it('saves the refunded payment', async () => {
      const { payment } = await paidBooking();

      await service.refund(payment.id, 3000);

      expect((await payments.findById(payment.id))?.status).toBe('refunded');
    });

    it('does not change the booking: that is the cancellation flow\'s job', async () => {
      const { booking, payment } = await paidBooking();

      await service.refund(payment.id);

      expect(await statusOf(booking.id)).toBe('confirmed');
    });

    it('throws for an unknown payment', async () => {
      await expect(service.refund(999)).rejects.toThrow(PaymentNotFoundError);
    });

    it('refuses a payment that did not succeed, without calling the gateway', async () => {
      const booking = await bookRoom();
      gateway.declining = true;
      const declined = await service.pay({ bookingId: booking.id, method: 'UPI', details: upi });

      await expect(service.refund(declined.id)).rejects.toThrow(InvalidPaymentTransitionError);

      expect(gateway.refunds).toEqual([]);
    });

    it('refuses a second refund, calling the gateway only once', async () => {
      const { payment } = await paidBooking();
      await service.refund(payment.id);

      await expect(service.refund(payment.id)).rejects.toThrow(InvalidPaymentTransitionError);

      expect(gateway.refunds).toHaveLength(1);
    });

    it.each([0, -5, 8001])('refuses an amount of %s without calling the gateway', async (amount) => {
      const { payment } = await paidBooking();

      await expect(service.refund(payment.id, amount)).rejects.toThrow(InvalidPaymentError);

      expect(gateway.refunds).toEqual([]);
      expect((await payments.findById(payment.id))?.status).toBe('success');
    });

    it('leaves the payment successful when the gateway refuses, so it can be tried again', async () => {
      const { payment } = await paidBooking();
      gateway.failRefunds = true;

      await expect(service.refund(payment.id)).rejects.toThrow(RefundFailedError);
      expect((await payments.findById(payment.id))?.status).toBe('success');

      gateway.failRefunds = false;
      const retried = await service.refund(payment.id);
      expect(retried.status).toBe('refunded');
    });

    it('turns away a second refund of the same payment started at the same time', async () => {
      const { payment } = await paidBooking();

      const outcomes = await Promise.allSettled([service.refund(payment.id), service.refund(payment.id)]);

      const rejected = outcomes.filter((outcome) => outcome.status === 'rejected');
      expect(rejected).toHaveLength(1);
      expect(rejected[0]?.reason).toBeInstanceOf(PaymentInProgressError);
      expect(gateway.refunds).toHaveLength(1);
    });
  });
});
