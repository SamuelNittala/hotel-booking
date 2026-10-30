const DATE_FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Number of days from `from` to `to`, both valid 'YYYY-MM-DD' strings. Date-only strings parse as UTC midnight, so daylight saving cannot shift the result. */
export function daysBetween(from: string, to: string): number {
  return (Date.parse(to) - Date.parse(from)) / MS_PER_DAY;
}

/** True if `value` is a real calendar date written as 'YYYY-MM-DD' (rejects '2026-02-30', '2026-13-01', '2026-1-3'). */
export function isValidDateString(value: string): boolean {
  const match = DATE_FORMAT.exec(value);
  if (!match) return false;

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
