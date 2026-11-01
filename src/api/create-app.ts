import express, { Express } from 'express';
import { AppServices } from '../app/create-services';
import { errorHandler, notFoundHandler } from './error-handler';
import { bookingRoutes } from './routes/booking-routes';
import { docsRoutes } from './routes/docs-routes';
import { paymentRoutes } from './routes/payment-routes';
import { propertyRoutes } from './routes/property-routes';
import { searchRoutes } from './routes/search-routes';

export function createApp(services: AppServices): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use(docsRoutes());
  app.use(propertyRoutes(services.properties));
  app.use(searchRoutes(services.search));
  app.use(bookingRoutes(services.bookingService, services.bookings, services.cancellations));
  app.use(paymentRoutes(services.paymentService, services.bookings));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
