import { DomainError } from '../shared/errors';

export class InvalidPropertyError extends DomainError {}

export class RoomIdAlreadyUsedError extends DomainError {
  constructor(roomId: number, otherPropertyId: number) {
    super(`Room id ${roomId} already belongs to property ${otherPropertyId}`);
  }
}

export class PropertyNotFoundError extends DomainError {
  constructor(propertyId: number) {
    super(`Property ${propertyId} does not exist`);
  }
}

export class DuplicateRoomError extends DomainError {
  constructor(propertyId: number, roomId: number) {
    super(`Property ${propertyId} already has a room with id ${roomId}`);
  }
}
