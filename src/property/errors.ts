import { DomainError } from '../shared/errors';

export class InvalidPropertyError extends DomainError {}

export class DuplicateRoomError extends DomainError {
  constructor(propertyId: number, roomId: number) {
    super(`Property ${propertyId} already has a room with id ${roomId}`);
  }
}
