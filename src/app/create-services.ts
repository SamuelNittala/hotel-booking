import { InMemoryAvailability } from '../availability/in-memory-availability';
import { BookingExpiryService } from '../booking/booking-expiry-service';
import { BookingRepository } from '../booking/booking-repository';
import { BookingService } from '../booking/booking-service';
import { InMemoryBookingRepository } from '../booking/in-memory-booking-repository';
import { CancellationService } from '../cancellation/cancellation-service';
import { TimeBasedRefundPolicy } from '../cancellation/policy/time-based-refund-policy';
import { RefundPolicy } from '../cancellation/refund-policy';
import { MockPaymentGateway } from '../payment/gateway/mock-payment-gateway';
import { PaymentGateway } from '../payment/gateway/payment-gateway';
import { InMemoryPaymentRepository } from '../payment/in-memory-payment-repository';
import { CardPaymentMethod } from '../payment/method/card-payment-method';
import { PaymentMethodRegistry } from '../payment/method/payment-method-registry';
import { UpiPaymentMethod } from '../payment/method/upi-payment-method';
import { WalletPaymentMethod } from '../payment/method/wallet-payment-method';
import { PaymentRepository } from '../payment/payment-repository';
import { PaymentService } from '../payment/payment-service';
import { InMemoryPropertyRepository } from '../property/in-memory-property-repository';
import { PropertyService } from '../property/property-service';
import { SearchService } from '../search/search-service';
import { SequentialIdGenerator } from '../shared/sequential-id-generator';

export type AppServices = {
  properties: PropertyService;
  search: SearchService;
  bookingService: BookingService;
  bookings: BookingRepository;
  paymentService: PaymentService;
  payments: PaymentRepository;
  cancellations: CancellationService;
  expiry: BookingExpiryService;
};

export type AppOptions = {
  gateway?: PaymentGateway;
  refundPolicy?: RefundPolicy;
  now?: () => Date;
  paymentWindowMinutes?: number;
  maxFailedAttempts?: number;
};

export function createServices(options: AppOptions = {}): AppServices {
  const propertyRepository = new InMemoryPropertyRepository();
  const bookings = new InMemoryBookingRepository();
  const payments = new InMemoryPaymentRepository();
  const availability = new InMemoryAvailability();

  const gateway = options.gateway ?? new MockPaymentGateway((request) => request.payer.startsWith('decline'));
  const methods = new PaymentMethodRegistry([
    new UpiPaymentMethod(gateway),
    new WalletPaymentMethod(gateway),
    new CardPaymentMethod(gateway),
  ]);

  const properties = new PropertyService(propertyRepository, new SequentialIdGenerator());
  const search = new SearchService(propertyRepository, availability);
  const bookingService = new BookingService(
    propertyRepository,
    bookings,
    availability,
    new SequentialIdGenerator(),
    options.now,
  );
  const paymentService = new PaymentService(
    payments,
    bookings,
    bookingService,
    methods,
    new SequentialIdGenerator(),
    options.maxFailedAttempts,
  );
  const cancellations = new CancellationService(
    bookings,
    payments,
    bookingService,
    paymentService,
    options.refundPolicy ?? TimeBasedRefundPolicy.standard(),
    options.now,
  );
  const expiry = new BookingExpiryService(bookings, bookingService, options.paymentWindowMinutes, options.now);

  return { properties, search, bookingService, bookings, paymentService, payments, cancellations, expiry };
}
