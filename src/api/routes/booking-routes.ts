import { Router } from 'express';
import { BookingRepository } from '../../booking/booking-repository';
import { BookingService } from '../../booking/booking-service';
import { BookingNotFoundError } from '../../booking/errors';
import { CancellationService } from '../../cancellation/cancellation-service';
import { DateRange } from '../../shared/date-range';
import { bookingJson, cancellationJson } from '../serializers';
import { asObject, parseId, requireInteger, requireString } from '../validation';

export function bookingRoutes(
  bookingService: BookingService,
  bookings: BookingRepository,
  cancellations: CancellationService,
): Router {
  const router = Router();

  router.post('/bookings', async (req, res) => {
    const body = asObject(req.body);

    const booking = await bookingService.book({
      guestId: requireInteger(body, 'guestId'),
      propertyId: requireInteger(body, 'propertyId'),
      roomType: requireString(body, 'roomType'),
      guestCount: requireInteger(body, 'guestCount'),
      dateRange: DateRange.of(requireString(body, 'fromDate'), requireString(body, 'toDate')),
    });

    res.status(201).json(bookingJson(booking));
  });

  router.get('/bookings/:bookingId', async (req, res) => {
    const bookingId = parseId(req.params.bookingId, 'bookingId');

    const booking = await bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }

    res.json(bookingJson(booking));
  });

  router.post('/bookings/:bookingId/cancel', async (req, res) => {
    const result = await cancellations.cancel(parseId(req.params.bookingId, 'bookingId'));

    res.json(cancellationJson(result));
  });

  return router;
}
