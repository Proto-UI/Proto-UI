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
  const snapped = min + Math.round((bounded - min) / step) * step;
  if (Number.isFinite(snapped)) {
    // Preserve the existing ordinary/subnormal decimal-noise normalization.
    return clamp(Number(snapped.toPrecision(14)), min, max);
  }
  // Finite endpoints can overflow either the offset, step count, or product.
  // Compare grid phases instead: each positive remainder is within one step,
  // so their difference is finite even when the total grid index is not.
  const minRemainder = min % step;
  const valueRemainder = bounded % step;
  const minPhase = minRemainder < 0 ? minRemainder + step : minRemainder;
  const valuePhase = valueRemainder < 0 ? valueRemainder + step : valueRemainder;
  const phaseDifference = valuePhase - minPhase;
  const remainder = phaseDifference < 0 ? phaseDifference + step : phaseDifference;
  if (remainder === 0) return bounded;
  // Like Math.round on the nonnegative grid index, midpoint ties go upward.
  const nearest = remainder < step / 2 ? bounded - remainder : bounded + (step - remainder);
  return clamp(nearest, min, max);
}
/** Finite endpoint midpoint without losing the ordinary/subnormal sum path. */
export function midpoint(min: number, max: number) {
  const sum = min + max;
  return Number.isFinite(sum) ? sum / 2 : min / 2 + max / 2;
}
