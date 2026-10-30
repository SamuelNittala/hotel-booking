import { daysBetween, isValidDateString } from './date-utils';
import { InvalidDateRangeError } from './errors';

/**
 * A stay from `fromDate` (inclusive) to `toDate` (exclusive): Nov 1 to Nov 3 occupies the nights of Nov 1 and Nov 2.
 * Dates are plain 'YYYY-MM-DD' strings.
 */
export class DateRange {
  private constructor(
    readonly fromDate: string,
    readonly toDate: string,
  ) {}

  /** Validates the input and creates a range. */
  static of(fromDate: string, toDate: string): DateRange {
    if (!isValidDateString(fromDate)) {
      throw new InvalidDateRangeError(`fromDate is not a valid YYYY-MM-DD date: '${fromDate}'`);
    }
    if (!isValidDateString(toDate)) {
      throw new InvalidDateRangeError(`toDate is not a valid YYYY-MM-DD date: '${toDate}'`);
    }
    if (toDate <= fromDate) {
      throw new InvalidDateRangeError(`toDate must be after fromDate (got ${fromDate} to ${toDate})`);
    }
    return new DateRange(fromDate, toDate);
  }

  overlaps(other: DateRange): boolean {
    return (other.fromDate < this.toDate) && (other.toDate > this.fromDate);
  }

  nights(): number {
    return daysBetween(this.fromDate, this.toDate);
  }
}
