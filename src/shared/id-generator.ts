/**
 * Hands out ids for new entities (bookings, payments, properties, rooms), so no service invents its own.
 * One generator is shared by everything, which keeps room ids unique across all properties.
 * It is synchronous on purpose: a service can take an id in the middle of a step without giving up its turn.
 * A real system would swap in database sequences or UUIDs generated in the application.
 */
export interface IdGenerator {
  next(): number;
}
