import { describe, expect, it } from 'vitest';
import { DateRange } from '../../src/shared/date-range';
import { InvalidDateRangeError } from '../../src/shared/errors';

describe('DateRange.of', () => {
  it('creates a range from two valid dates', () => {
    const range = DateRange.of('2026-11-01', '2026-11-03');

    expect(range.fromDate).toBe('2026-11-01');
    expect(range.toDate).toBe('2026-11-03');
  });

  it('rejects a malformed fromDate', () => {
    expect(() => DateRange.of('2026-1-3', '2026-11-03')).toThrow(InvalidDateRangeError);
    expect(() => DateRange.of('garbage', '2026-11-03')).toThrow(InvalidDateRangeError);
  });

  it('rejects a malformed toDate', () => {
    expect(() => DateRange.of('2026-11-01', 'garbage')).toThrow(InvalidDateRangeError);
    expect(() => DateRange.of('2026-11-01', '11/03/2026')).toThrow(InvalidDateRangeError);
  });

  it('rejects dates that do not exist', () => {
    expect(() => DateRange.of('2026-02-30', '2026-03-05')).toThrow(InvalidDateRangeError);
    expect(() => DateRange.of('2026-11-01', '2026-11-31')).toThrow(InvalidDateRangeError);
    expect(() => DateRange.of('2026-13-01', '2026-13-05')).toThrow(InvalidDateRangeError);
  });

  it('accepts Feb 29 only in a leap year', () => {
    expect(() => DateRange.of('2028-02-28', '2028-02-29')).not.toThrow();
    expect(() => DateRange.of('2027-02-28', '2027-02-29')).toThrow(InvalidDateRangeError);
  });

  it('rejects a range where toDate equals fromDate', () => {
    expect(() => DateRange.of('2026-11-01', '2026-11-01')).toThrow(InvalidDateRangeError);
  });

  it('rejects a range where toDate is before fromDate', () => {
    expect(() => DateRange.of('2026-11-03', '2026-11-01')).toThrow(InvalidDateRangeError);
  });

  it('accepts a range that crosses a year boundary', () => {
    expect(() => DateRange.of('2026-12-30', '2027-01-02')).not.toThrow();
  });
});

describe('DateRange.overlaps', () => {
  const range = (from: string, to: string) => DateRange.of(from, to);

  it('does not overlap when one stay checks out the day the other checks in', () => {
    const first = range('2026-11-01', '2026-11-03');
    const second = range('2026-11-03', '2026-11-05');

    expect(first.overlaps(second)).toBe(false);
    expect(second.overlaps(first)).toBe(false);
  });

  it('overlaps when the stays share a night', () => {
    const first = range('2026-11-01', '2026-11-03');
    const second = range('2026-11-02', '2026-11-04');

    expect(first.overlaps(second)).toBe(true);
    expect(second.overlaps(first)).toBe(true);
  });

  it('overlaps with an identical range', () => {
    const first = range('2026-11-01', '2026-11-03');

    expect(first.overlaps(range('2026-11-01', '2026-11-03'))).toBe(true);
  });

  it('overlaps when one range contains the other', () => {
    const outer = range('2026-11-01', '2026-11-10');
    const inner = range('2026-11-03', '2026-11-05');

    expect(outer.overlaps(inner)).toBe(true);
    expect(inner.overlaps(outer)).toBe(true);
  });

  it('does not overlap when the ranges are far apart', () => {
    const first = range('2026-11-01', '2026-11-03');
    const second = range('2026-11-10', '2026-11-12');

    expect(first.overlaps(second)).toBe(false);
    expect(second.overlaps(first)).toBe(false);
  });

  it('does not treat the same days in different years as overlapping', () => {
    const thisYear = range('2026-11-01', '2026-11-03');
    const nextYear = range('2027-11-01', '2027-11-03');

    expect(thisYear.overlaps(nextYear)).toBe(false);
  });

  it('works across a year boundary', () => {
    const newYear = range('2026-12-30', '2027-01-02');

    expect(newYear.overlaps(range('2027-01-01', '2027-01-05'))).toBe(true);
    expect(newYear.overlaps(range('2027-01-02', '2027-01-05'))).toBe(false);
  });
});

describe('DateRange.nights', () => {
  it('counts one night for consecutive days', () => {
    expect(DateRange.of('2026-11-01', '2026-11-02').nights()).toBe(1);
  });

  it('counts the nights of a normal stay', () => {
    expect(DateRange.of('2026-11-01', '2026-11-03').nights()).toBe(2);
  });

  it('counts nights across a year boundary (Dec 30, Dec 31, Jan 1)', () => {
    expect(DateRange.of('2026-12-30', '2027-01-02').nights()).toBe(3);
  });

  it('counts February correctly in a normal year (Feb 27, Feb 28)', () => {
    expect(DateRange.of('2027-02-27', '2027-03-01').nights()).toBe(2);
  });

  it('counts February correctly in a leap year (Feb 27, 28, 29)', () => {
    expect(DateRange.of('2028-02-27', '2028-03-01').nights()).toBe(3);
  });

  it('is not thrown off by daylight saving changes', () => {
    expect(DateRange.of('2026-03-28', '2026-03-30').nights()).toBe(2);
    expect(DateRange.of('2026-03-07', '2026-03-09').nights()).toBe(2);
    expect(DateRange.of('2026-10-24', '2026-10-26').nights()).toBe(2);
  });
});
