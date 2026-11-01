import { ErrorRequestHandler, RequestHandler } from 'express';
import { BookingAlreadyReservedError, RoomUnavailableError } from '../availability/availability';
import {
  BookingNotFoundError,
  InvalidBookingError,
  InvalidBookingTransitionError,
  NoMatchingRoomError,
  NoRoomAvailableError,
  StayTooShortError,
} from '../booking/errors';
import { InvalidRefundAmountError, InvalidRefundPolicyError, NoSuccessfulPaymentError } from '../cancellation/errors';
import {
  BookingNotPayableError,
  InvalidPaymentError,
  InvalidPaymentTransitionError,
  PaymentInProgressError,
  PaymentNotFoundError,
  RefundFailedError,
  UnsupportedPaymentMethodError,
} from '../payment/errors';
import {
  DuplicateRoomError,
  InvalidPropertyError,
  PropertyNotFoundError,
  RoomIdAlreadyUsedError,
} from '../property/errors';
import { DomainError, InvalidDateRangeError } from '../shared/errors';
import { BadRequestError } from './errors';

type ErrorClass = abstract new (...args: never[]) => Error;

const STATUS_BY_ERROR: readonly (readonly [ErrorClass, number])[] = [
  [BadRequestError, 400],
  [InvalidDateRangeError, 400],
  [InvalidPropertyError, 400],
  [InvalidBookingError, 400],
  [InvalidPaymentError, 400],
  [UnsupportedPaymentMethodError, 400],

  [PropertyNotFoundError, 404],
  [BookingNotFoundError, 404],
  [PaymentNotFoundError, 404],

  [NoRoomAvailableError, 409],
  [RoomUnavailableError, 409],
  [BookingAlreadyReservedError, 409],
  [InvalidBookingTransitionError, 409],
  [InvalidPaymentTransitionError, 409],
  [BookingNotPayableError, 409],
  [PaymentInProgressError, 409],
  [DuplicateRoomError, 409],
  [RoomIdAlreadyUsedError, 409],
  [NoSuccessfulPaymentError, 409],

  [StayTooShortError, 422],
  [NoMatchingRoomError, 422],

  [InvalidRefundAmountError, 500],
  [InvalidRefundPolicyError, 500],

  [RefundFailedError, 502],
];

function statusFor(error: unknown): number | undefined {
  const match = STATUS_BY_ERROR.find(([errorClass]) => error instanceof errorClass);
  if (match) return match[1];
  return error instanceof DomainError ? 400 : undefined;
}

const send = (res: Parameters<ErrorRequestHandler>[2], status: number, type: string, message: string) =>
  res.status(status).json({ error: { type, message } });

export const notFoundHandler: RequestHandler = (req, res) => {
  send(res, 404, 'NotFound', `No route for ${req.method} ${req.path}`);
};

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  const status = statusFor(error);
  if (status !== undefined) {
    send(res, status, (error as Error).name, (error as Error).message);
    return;
  }
  if (error?.type === 'entity.parse.failed') {
    send(res, 400, 'BadRequestError', 'Request body is not valid JSON');
    return;
  }
  console.error(error);
  send(res, 500, 'InternalServerError', 'Something went wrong');
};
