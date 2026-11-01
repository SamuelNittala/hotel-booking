import { Router } from 'express';
import { BookingRepository } from '../../booking/booking-repository';
import { PaymentStatus } from '../../payment/payment-status';
import { PaymentService } from '../../payment/payment-service';
import { bookingJson, paymentJson } from '../serializers';
import { asObject, optionalNumber, optionalStringMap, parseId, requireString } from '../validation';

const statusForAttempt = (status: PaymentStatus): number => {
  if (status === 'success') return 201;
  if (status === 'failure') return 402;
  return 409;
};

export function paymentRoutes(payments: PaymentService, bookings: BookingRepository): Router {
  const router = Router();

  router.post('/bookings/:bookingId/payments', async (req, res) => {
    const bookingId = parseId(req.params.bookingId, 'bookingId');
    const body = asObject(req.body);

    const payment = await payments.pay({
      bookingId,
      method: requireString(body, 'method'),
      details: optionalStringMap(body, 'details'),
    });

    const booking = await bookings.findById(bookingId);
    res.status(statusForAttempt(payment.status)).json({
      payment: paymentJson(payment),
      booking: booking ? bookingJson(booking) : null,
    });
  });

  router.post('/payments/:paymentId/refunds', async (req, res) => {
    const paymentId = parseId(req.params.paymentId, 'paymentId');
    const body = asObject(req.body ?? {});

    const payment = await payments.refund(paymentId, optionalNumber(body, 'amount'));

    res.json(paymentJson(payment));
  });

  return router;
}
