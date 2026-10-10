/** Finite range normalization shared by read-only and editable numerical atoms. */
export function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
export function range(min: unknown, max: unknown, fallbackMax = 100) {
  const lower = finite(min, 0);
  const upper = Math.max(lower, finite(max, fallbackMax));
  return { min: lower, max: upper };
}
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
export function percentage(value: number, min: number, max: number) {
  if (max === min) return 0;
  const span = max - min;
  // Finite endpoints can still overflow their difference. Scale both axes only
  // in that case, preserving the ordinary/subnormal path and finite State values.
  if (!Number.isFinite(span)) {
    return clamp(((value / 2 - min / 2) / (max / 2 - min / 2)) * 100, 0, 100);
  }
  return clamp(((value - min) / span) * 100, 0, 100);
}
export function quantize(value: number, min: number, max: number, step: number) {
  const bounded = clamp(value, min, max);
  if (!(step > 0) || !Number.isFinite(step)) return bounded;
  return clamp(Number((min + Math.round((bounded - min) / step) * step).toPrecision(14)), min, max);
}
