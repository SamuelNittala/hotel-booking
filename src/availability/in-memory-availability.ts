import { DateRange } from "../shared/date-range";
import {
  Availability,
  BookingAlreadyReservedError,
  Reservation,
  RoomUnavailableError,
} from "./availability";

export class InMemoryAvailability implements Availability {
  private readonly reservationsByRoom = new Map<number, Reservation[]>();
  private readonly reservationsByBooking = new Map<number, Reservation>();

  private isFree(dateRange: DateRange, roomId: number): boolean {
    const currentRoomReservations = this.reservationsByRoom.get(roomId) || [];
    const roomDateRanges = currentRoomReservations.map(
      (reservation) => reservation.dateRange,
    );
    return roomDateRanges.every(
      (currentDateRange) => !currentDateRange.overlaps(dateRange),
    );
  }

  async check(dateRange: DateRange, roomId: number): Promise<boolean> {
    return this.isFree(dateRange, roomId);
  }

  async reserve(
    dateRange: DateRange,
    roomId: number,
    bookingId: number,
  ): Promise<Reservation> {
    if (this.reservationsByBooking.has(bookingId)) {
      throw new BookingAlreadyReservedError(bookingId);
    }
    const roomAvailable = this.isFree(dateRange, roomId);
    if (!roomAvailable) {
      throw new RoomUnavailableError(roomId, dateRange);
    }
    const newReservation: Reservation = {
      bookingId,
      roomId,
      dateRange,
    };
    const currentRoomReservations = this.reservationsByRoom.get(roomId) || [];
    this.reservationsByRoom.set(roomId, [
      ...currentRoomReservations,
      newReservation,
    ]);
    this.reservationsByBooking.set(bookingId, newReservation);
    return newReservation;
  }

  async release(bookingId: number): Promise<boolean> {
    const reservation = this.reservationsByBooking.get(bookingId);
    if (!reservation) return false;

    const remaining = (this.reservationsByRoom.get(reservation.roomId) ?? []).filter(
      (roomReservation) => roomReservation.bookingId !== bookingId,
    );
    this.reservationsByRoom.set(reservation.roomId, remaining);
    this.reservationsByBooking.delete(bookingId);
    return true;
  }
}
