import { dateAvailable, parseDate } from './model';
import type { CalendarRange, CalendarRootProps, CalendarSelectionMode } from './types';

export function isCalendarValues(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  for (let index = 0; index < value.length; index++) {
    if (
      !Object.hasOwn(value, index) ||
      typeof value[index] !== 'string' ||
      !parseDate(value[index])
    )
      return false;
  }
  return true;
}

export function isCalendarRange(value: unknown): value is CalendarRange {
  if (
    !value ||
    Object.prototype.toString.call(value) !== '[object Object]' ||
    Object.keys(value).some((key) => key !== 'from' && key !== 'to')
  )
    return false;
  const range = value as CalendarRange;
  return (
    (range.from === undefined || (typeof range.from === 'string' && !!parseDate(range.from))) &&
    (range.to === undefined || (typeof range.to === 'string' && !!parseDate(range.to))) &&
    (!range.to || !!range.from)
  );
}

export function normalizeCalendarValues(value: readonly string[]): string[] {
  return [...new Set(value)].sort();
}

export function normalizeCalendarRange(value: CalendarRange): CalendarRange {
  if (!value.from) return {};
  if (!value.to) return { from: value.from };
  return value.from <= value.to
    ? { from: value.from, to: value.to }
    : { from: value.to, to: value.from };
}

export function calendarRangeNights(range: CalendarRange): number {
  const from = range.from && parseDate(range.from),
    to = range.to && parseDate(range.to);
  return from && to ? (to.getTime() - from.getTime()) / 86_400_000 : 0;
}

export function calendarValuesAvailable(
  values: readonly string[],
  props: CalendarRootProps,
  allowMinimumProgress = false
): boolean {
  const min = props.minSelected ?? 0,
    max = props.maxSelected ?? Infinity;
  return (
    min <= max &&
    (allowMinimumProgress || values.length >= min) &&
    values.length <= max &&
    values.every((date) => dateAvailable(date, props.min, props.max, props.unavailable))
  );
}

export function calendarRangeAvailable(range: CalendarRange, props: CalendarRootProps): boolean {
  const min = props.minNights ?? 0,
    max = props.maxNights ?? Infinity;
  if (min > max) return false;
  if (!range.from) return true;
  if (!dateAvailable(range.from, props.min, props.max, props.unavailable)) return false;
  if (!range.to) return true;
  const nights = calendarRangeNights(range);
  return (
    dateAvailable(range.to, props.min, props.max, props.unavailable) &&
    nights >= min &&
    nights <= max &&
    !(props.unavailable ?? []).some(
      (date) => !!parseDate(date) && date >= range.from! && date <= range.to!
    )
  );
}

export function calendarSelectionKey(
  mode: CalendarSelectionMode,
  value: string,
  values: readonly string[],
  range: CalendarRange
): string {
  return JSON.stringify(
    mode === 'multiple'
      ? [mode, values]
      : mode === 'range'
        ? [mode, range.from, range.to]
        : [mode, value]
  );
}

export function calendarDaySelection(
  date: string,
  mode: CalendarSelectionMode,
  value: string,
  values: readonly string[],
  range: CalendarRange
) {
  const rangeStart = !!date && mode === 'range' && date === range.from;
  const rangeEnd = !!date && mode === 'range' && date === range.to;
  const rangeMiddle =
    !!date &&
    mode === 'range' &&
    !!range.from &&
    !!range.to &&
    date > range.from &&
    date < range.to;
  return {
    selected:
      !!date &&
      (mode === 'range'
        ? rangeStart || rangeEnd || rangeMiddle
        : mode === 'multiple'
          ? values.includes(date)
          : date === value),
    rangeStart,
    rangeEnd,
    rangeMiddle,
    rangePending: rangeStart && !range.to,
  };
}
