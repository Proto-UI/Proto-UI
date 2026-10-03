// Test-only geometry for a native pointer probe shared by source and preview.
type Rect = { x: number; y: number; width: number; height: number };
export function sharedImageHitPoint(source: Rect, preview: Rect) {
  if (
    [source, preview].some(
      (rect) =>
        ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
        rect.width <= 0 ||
        rect.height <= 0
    )
  )
    return null;
  const left = Math.max(source.x, preview.x);
  const right = Math.min(source.x + source.width, preview.x + preview.width);
  const top = Math.max(source.y, preview.y);
  const bottom = Math.min(source.y + source.height, preview.y + preview.height);
  if (left >= right || top >= bottom) return null;
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}
