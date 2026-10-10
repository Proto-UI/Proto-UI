/** Gregorian date-only arithmetic. UTC avoids DST and local-time date rollover. */
export function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}
export const dateKey = (date: Date): string => date.toISOString().slice(0, 10);
export function addDays(value: string, count: number): string {
  const date = parseDate(value);
  if (!date || !Number.isSafeInteger(count)) return value;
  date.setUTCDate(date.getUTCDate() + count);
  return Number.isFinite(date.getTime()) ? dateKey(date) : value;
}
export function addMonths(value: string, count: number): string {
  const date = parseDate(value);
  if (!date || !Number.isSafeInteger(count)) return value;
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + count);
  const end = new Date(date.getTime());
  end.setUTCMonth(end.getUTCMonth() + 1, 0);
  date.setUTCDate(Math.min(day, end.getUTCDate()));
  return dateKey(date);
}
export function monthDays(month: string, weekStartsOn = 0): string[] {
  const first = parseDate(`${month}-01`);
  if (!first) return [];
  const start = ((Math.trunc(weekStartsOn) % 7) + 7) % 7;
  const offset = (first.getUTCDay() - start + 7) % 7;
  return Array.from({ length: 42 }, (_, index) => addDays(dateKey(first), index - offset));
}
export function dateAvailable(
  date: string,
  min = '',
  max = '',
  unavailable: readonly string[] = []
): boolean {
  return (
    !!parseDate(date) &&
    (!parseDate(min) || date >= min) &&
    (!parseDate(max) || date <= max) &&
    !unavailable.includes(date)
  );
}

/** Localized civil-date labels; the caller supplies the clock and locale boundary. */
export function calendarDateLabel(
  date: string,
  locale = 'en-US',
  options: Intl.DateTimeFormatOptions = { dateStyle: 'full' }
): string {
  const parsed = parseDate(date);
  if (!parsed) return '';
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' }).format(parsed);
  } catch {
    return new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(parsed);
  }
}
export function calendarWeekdayInfo(offset: number, weekStartsOn = 0, locale = 'en-US') {
  const start = Math.trunc(Number.isFinite(weekStartsOn) ? weekStartsOn : 0);
  const weekday = (((Math.trunc(Number.isFinite(offset) ? offset : 0) + start) % 7) + 7) % 7;
  const date = addDays('2023-01-01', weekday);
  const short = calendarDateLabel(date, locale, { weekday: 'short' });
  return {
    weekday,
    label: /^en(?:-|$)/i.test(locale) ? short.slice(0, 2) : short,
    description: calendarDateLabel(date, locale, { weekday: 'long' }),
  };
}
