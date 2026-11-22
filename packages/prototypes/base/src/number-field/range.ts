import { finite, snapToGrid } from '../progress/range';

/** Omitted bounds retain the family defaults; explicit null withdraws a bound. */
export function numberFieldRange(min: unknown, max: unknown) {
  const lower = min === null ? null : finite(min, 0);
  const upper = max === null ? null : finite(max, 100);
  return { min: lower, max: lower !== null && upper !== null ? Math.max(lower, upper) : upper };
}

export function normalizeNumberFieldValue(
  value: number,
  min: unknown,
  max: unknown,
  step: number,
  snap: boolean
) {
  const bounds = numberFieldRange(min, max);
  const clamp = (next: number) => {
    const aboveMinimum = bounds.min === null ? next : Math.max(bounds.min, next);
    return bounds.max === null ? aboveMinimum : Math.min(bounds.max, aboveMinimum);
  };
  const bounded = clamp(value);
  if (!snap) return bounded;
  // An absent minimum uses the zero grid, never an artificial huge negative bound.
  const snapped = clamp(snapToGrid(bounded, bounds.min ?? 0, step));
  return Number.isFinite(snapped) ? snapped : bounded;
}
