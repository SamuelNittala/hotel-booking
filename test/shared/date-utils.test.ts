import { describe, expect, it } from 'vitest';
import { daysBetween, isValidDateString } from '../../src/shared/date-utils';

describe('isValidDateString', () => {
  it.each(['2026-11-01', '2026-01-01', '2026-12-31', '2028-02-29', '2000-02-29'])('accepts %s', (value) => {
    expect(isValidDateString(value)).toBe(true);
  });

  it.each([
    ['Feb 29 in a normal year', '2027-02-29'],
    ['Feb 29 in a century year that is not a leap year', '1900-02-29'],
    ['Feb 30', '2026-02-30'],
    ['day 31 in a 30-day month', '2026-04-31'],
    ['month 13', '2026-13-01'],
    ['month 0', '2026-00-10'],
    ['day 0', '2026-11-00'],
  ])('rejects a date that does not exist: %s', (_label, value) => {
    expect(isValidDateString(value)).toBe(false);
  });

  it.each([
    ['missing zero padding', '2026-1-3'],
    ['two-digit year', '26-11-01'],
    ['slashes', '2026/11/01'],
    ['day first', '01-11-2026'],
    ['empty string', ''],
    ['leading space', ' 2026-11-01'],
    ['trailing space', '2026-11-01 '],
    ['date with a time', '2026-11-01T00:00:00'],
    ['text', 'garbage'],
  ])('rejects the wrong format: %s', (_label, value) => {
    expect(isValidDateString(value)).toBe(false);
  });
});

describe('daysBetween', () => {
  it('is 0 for the same day', () => {
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0);
  });

  it('is 1 for consecutive days', () => {
    expect(daysBetween('2026-11-01', '2026-11-02')).toBe(1);
  });

  it('counts days within a month', () => {
    expect(daysBetween('2026-11-01', '2026-11-03')).toBe(2);
  });

  it('counts days across a year boundary', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
  });

  it('counts February correctly in a normal year and a leap year', () => {
    expect(daysBetween('2027-02-27', '2027-03-01')).toBe(2);
    expect(daysBetween('2028-02-27', '2028-03-01')).toBe(3);
  });

  it('counts a whole normal year and a whole leap year', () => {
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365);
    expect(daysBetween('2028-01-01', '2029-01-01')).toBe(366);
  });

  it('is not thrown off by daylight saving changes', () => {
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });

  it('is negative when the end is before the start', () => {
    expect(daysBetween('2026-11-03', '2026-11-01')).toBe(-2);
  });
});
