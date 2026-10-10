export function resizeValue(value: number, min = 10, max = 90, collapsible = false): number {
  const low = Math.max(0, Math.min(100, Number.isFinite(min) ? min : 10));
  const high = Math.max(low, Math.min(100, Number.isFinite(max) ? max : 90));
  if (!Number.isFinite(value)) return low;
  if (collapsible && value < low / 2) return 0;
  return Math.round(Math.max(low, Math.min(high, value)) * 100) / 100;
}
