export interface TextFragmentRect { top: number; bottom: number; width: number; height: number }
/** Range can return several fragments for one ellipsized line. Require one
 * common vertical band, not a count or a chain of partially overlapping lines. */
export function textFragmentsShareLine(rects: readonly TextFragmentRect[]): boolean {
  if (!rects.length) return false;
  return rects.every((rect) =>
    [rect.top, rect.bottom, rect.width, rect.height].every(Number.isFinite) &&
    rect.width > 0 && rect.height > 0 && rect.bottom > rect.top &&
    Math.abs(rect.bottom - rect.top - rect.height) <= 1
  ) && Math.max(...rects.map((rect) => rect.top)) - Math.min(...rects.map((rect) => rect.top)) <= 1
    && Math.max(...rects.map((rect) => rect.bottom)) - Math.min(...rects.map((rect) => rect.bottom)) <= 1
    && Math.max(...rects.map((rect) => rect.top)) < Math.min(...rects.map((rect) => rect.bottom));
}
