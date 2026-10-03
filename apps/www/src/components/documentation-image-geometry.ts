export type ImageRect = { x: number; y: number; width: number; height: number };
export type ImageViewport = ImageRect;
const finiteRect = (r: ImageRect) =>
  [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.width > 0 && r.height > 0;

/** App-owned geometry only; no open, focus, dismissal or presence state. */
export function imageContainRect(
  width: number,
  height: number,
  viewport: ImageViewport
): ImageRect {
  const inset = Math.min(16, viewport.width / 20, viewport.height / 20);
  const availableWidth = Math.max(1, viewport.width - inset * 2);
  const availableHeight = Math.max(1, viewport.height - inset * 2);
  const ratio = width > 0 && height > 0 && Number.isFinite(width / height) ? width / height : 1;
  const w = Math.min(availableWidth, availableHeight * ratio);
  const h = w / ratio;
  return {
    x: viewport.x + (viewport.width - w) / 2,
    y: viewport.y + (viewport.height - h) / 2,
    width: w,
    height: h,
  };
}

export function imageOriginTransform(
  origin: ImageRect | null,
  target: ImageRect,
  viewport: ImageViewport
): string | null {
  // No flight toward removed, empty, nonfinite or wholly offscreen content.
  if (
    !origin ||
    !finiteRect(origin) ||
    !finiteRect(target) ||
    origin.x + origin.width <= viewport.x ||
    origin.y + origin.height <= viewport.y ||
    origin.x >= viewport.x + viewport.width ||
    origin.y >= viewport.y + viewport.height
  )
    return null;
  return `translate(${origin.x - target.x}px, ${origin.y - target.y}px) scale(${origin.width / target.width}, ${origin.height / target.height})`;
}
