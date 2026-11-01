import { Booking } from '../booking/booking';
import { CancellationResult } from '../cancellation/cancellation-service';
import { Payment } from '../payment/payment';
import { Property } from '../property/property';
import { Room } from '../property/room';
import { SearchResult } from '../search/search-result';

export const roomJson = (room: Room) => ({
  id: room.id,
  type: room.type,
  capacity: room.capacity,
  pricePerNight: room.pricePerNight,
});

const propertySummaryJson = (property: Property) => ({
  id: property.id,
  name: property.name,
  ownerId: property.ownerId,
  location: {
    city: property.location.city,
    locality: property.location.locality,
    latitude: property.location.latitude,
    longitude: property.location.longitude,
  },
  amenities: [...property.amenities].sort(),
  starRating: property.starRating,
  minNights: property.minNights,
});

export const propertyJson = (property: Property) => ({
  ...propertySummaryJson(property),
  rooms: property.rooms.map(roomJson),
});

export const bookingJson = (booking: Booking) => ({
  id: booking.id,
  guestId: booking.guestId,
  propertyId: booking.propertyId,
  roomId: booking.roomId,
  guestCount: booking.guestCount,
  fromDate: booking.dateRange.fromDate,
  toDate: booking.dateRange.toDate,
  totalAmount: booking.totalAmount,
  status: booking.status,
  createdAt: booking.createdAt.toISOString(),
});

export const paymentJson = (payment: Payment) => ({
  id: payment.id,
  bookingId: payment.bookingId,
  amount: payment.amount,
  method: payment.method,
  status: payment.status,
  refundedAmount: payment.refundedAmount,
  gatewayReference: payment.gatewayReference ?? null,
});

export const searchResultJson = (result: SearchResult) => ({
  property: propertySummaryJson(result.property),
  rooms: result.rooms.map((offer) => ({ ...roomJson(offer.room), totalPrice: offer.totalPrice })),
});

export const cancellationJson = (result: CancellationResult) => ({
  booking: bookingJson(result.booking),
  refundAmount: result.refundAmount,
  refundStatus: result.refundStatus,
  paymentId: result.paymentId ?? null,
});
