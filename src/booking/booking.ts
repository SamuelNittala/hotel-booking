import { DateRange } from '../shared/date-range';
import { BookingStatus } from './booking-status';
import { InvalidBookingError, InvalidBookingTransitionError } from './errors';

export type BookingProps = {
  id: number;
  guestId: number;
  propertyId: number;
  roomId: number;
  guestCount: number;
  dateRange: DateRange;
  totalAmount: number;
  createdAt: Date;
};

/** Which status a booking may move to from each status. Anything not listed is illegal. */
const ALLOWED_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  pending: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['cancelled'],
  cancelled: [],
  expired: [],
};

/**
 * A guest's booking of one room for a date range. It starts `pending` and only moves
 * through `confirm`, `cancel` and `expire`, so it can never be put into an illegal status.
 * It knows nothing about money movement or room inventory; the services around it do that.
 */
export class Booking {
  readonly id: number;
  readonly guestId: number;
  readonly propertyId: number;
  readonly roomId: number;
  readonly guestCount: number;
  readonly dateRange: DateRange;
  readonly totalAmount: number;
  readonly createdAt: Date;

  private currentStatus: BookingStatus = 'pending';

  private constructor(props: BookingProps) {
    this.id = props.id;
    this.guestId = props.guestId;
    this.propertyId = props.propertyId;
    this.roomId = props.roomId;
    this.guestCount = props.guestCount;
    this.dateRange = props.dateRange;
    this.totalAmount = props.totalAmount;
    this.createdAt = props.createdAt;
  }

  /** Creates a new `pending` booking after validating its basic fields. */
  static create(props: BookingProps): Booking {
    if (!Number.isInteger(props.guestCount) || props.guestCount < 1) {
      throw new InvalidBookingError(`guestCount must be a whole number of at least 1 (got ${props.guestCount})`);
    }
    if (!Number.isFinite(props.totalAmount) || props.totalAmount < 0) {
      throw new InvalidBookingError(`totalAmount must be zero or more (got ${props.totalAmount})`);
    }
    return new Booking(props);
  }

  get status(): BookingStatus {
    return this.currentStatus;
  }

  /** Payment succeeded. Only a pending booking can be confirmed. */
  confirm(): void {
    this.transitionTo('confirmed');
  }

  /** The guest cancelled. Allowed while pending or confirmed. */
  cancel(): void {
    this.transitionTo('cancelled');
  }

  /** The payment window ran out or retries were used up. Only a pending booking can expire. */
  expire(): void {
    this.transitionTo('expired');
  }

  private transitionTo(next: BookingStatus): void {
    if (!ALLOWED_TRANSITIONS[this.currentStatus].includes(next)) {
      throw new InvalidBookingTransitionError(this.id, this.currentStatus, next);
    }
    this.currentStatus = next;
  }
}
