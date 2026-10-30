/** Base class for every business-rule error, so callers can tell them apart from bugs. */
export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidDateRangeError extends DomainError {}
