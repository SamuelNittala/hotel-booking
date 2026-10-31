import { Availability, RoomUnavailableError } from '../availability/availability';
import { PropertyNotFoundError } from '../property/errors';
import { PropertyRepository } from '../property/property-repository';
import { GuestCountFilter } from '../search/filters/guest-count-filter';
import { RoomTypeFilter } from '../search/filters/room-type-filter';
import { DateRange } from '../shared/date-range';
import { IdGenerator } from '../shared/id-generator';
import { Booking } from './booking';
import { BookingRepository } from './booking-repository';
import { BookingNotFoundError, NoMatchingRoomError, NoRoomAvailableError, StayTooShortError } from './errors';

export type BookRoomRequest = {
  guestId: number;
  propertyId: number;
  roomType: string;
  guestCount: number;
  dateRange: DateRange;
};

export class BookingService {
  constructor(
    private readonly properties: PropertyRepository,
    private readonly bookings: BookingRepository,
    private readonly availability: Availability,
    private readonly ids: IdGenerator,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async book(request: BookRoomRequest): Promise<Booking> {
    const property = await this.properties.findById(request.propertyId);
    if (!property) {
      throw new PropertyNotFoundError(request.propertyId);
    }

    const nights = request.dateRange.nights();
    if (nights < property.minNights) {
      throw new StayTooShortError(property.id, property.minNights, nights);
    }

    const roomFilters = [new RoomTypeFilter(request.roomType), new GuestCountFilter(request.guestCount)];
    const candidates = property.rooms.filter((room) => roomFilters.every((filter) => filter.matches(room)));
    if (candidates.length === 0) {
      throw new NoMatchingRoomError(property.id, request.roomType, request.guestCount);
    }

    const bookingId = this.ids.next();
    for (const room of candidates) {
      const booking = Booking.create({
        id: bookingId,
        guestId: request.guestId,
        propertyId: property.id,
        roomId: room.id,
        guestCount: request.guestCount,
        dateRange: request.dateRange,
        totalAmount: room.pricePerNight * nights,
        createdAt: this.now(),
      });

      try {
        await this.availability.reserve(request.dateRange, room.id, bookingId);
      } catch (error) {
        if (error instanceof RoomUnavailableError) {
          continue;
        }
        throw error;
      }

      return this.saveOrRelease(booking);
    }
    throw new NoRoomAvailableError(property.id, request.roomType, request.dateRange);
  }

  async confirm(bookingId: number): Promise<Booking> {
    const booking = await this.load(bookingId);
    booking.confirm();
    await this.bookings.save(booking);
    return booking;
  }

  async cancel(bookingId: number): Promise<Booking> {
    const booking = await this.load(bookingId);
    booking.cancel();
    return this.saveThenRelease(booking);
  }

  async expire(bookingId: number): Promise<Booking> {
    const booking = await this.load(bookingId);
    booking.expire();
    return this.saveThenRelease(booking);
  }

  private async load(bookingId: number): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) {
      throw new BookingNotFoundError(bookingId);
    }
    return booking;
  }

  private async saveOrRelease(booking: Booking): Promise<Booking> {
    try {
      await this.bookings.save(booking);
    } catch (error) {
      await this.availability.release(booking.id);
      throw error;
    }
    return booking;
  }

  private async saveThenRelease(booking: Booking): Promise<Booking> {
    await this.bookings.save(booking);
    await this.availability.release(booking.id);
    return booking;
  }
}
