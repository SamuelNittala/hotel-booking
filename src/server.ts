import { createApp } from './api/create-app';
import { createServices } from './app/create-services';

const PORT = Number(process.env.PORT ?? 3000);
const EXPIRY_SWEEP_EVERY_MS = 60 * 1000;

const services = createServices();
const app = createApp(services);

const sweeper = setInterval(() => {
  services.expiry
    .expireOverdue()
    .then(({ expired, failed }) => {
      if (expired.length > 0) console.log(`Expired unpaid bookings: ${expired.join(', ')}`);
      failed.forEach(({ bookingId, error }) => console.error(`Could not expire booking ${bookingId}`, error));
    })
    .catch((error) => console.error('Expiry sweep failed', error));
}, EXPIRY_SWEEP_EVERY_MS);
sweeper.unref();

const server = app.listen(PORT, () => console.log(`Hotel booking API listening on http://localhost:${PORT}`));

process.on('SIGINT', () => {
  clearInterval(sweeper);
  server.close(() => process.exit(0));
});
