type Corner = Readonly<{ x: number; y: number }>;
type Bounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;
export type PaintedBorder = Readonly<{
  bounds: Bounds;
  corners: Readonly<{ tl: Corner; tr: Corner; br: Corner; bl: Corner }>;
  blockClearance: Readonly<{ top: number; bottom: number }>;
  signature: string;
}>;
export type BorderOutline =
  | { status: 'clear'; signature: string; blockClearance: { top: 0; bottom: 0 } }
  | {
      status: 'border';
      border: PaintedBorder;
      signature: string;
      blockClearance: { top: number; bottom: number };
    }
  | { status: 'unsupported' };

const transparent = (color: string) =>
  color === 'transparent' ||
  /^rgba\([^)]*,\s*0\)$/.test(color) ||
  /\/\s*0(?:%|\.0*)?\s*\)$/.test(color);
const px = (value: string): number | null => {
  if (value === '' || value === '0') return 0;
  if (!/^\d+(?:\.\d+)?px$/.test(value)) return null;
  const result = Number.parseFloat(value);
  return Number.isFinite(result) ? result : null;
};
function radius(value: string): Corner | null {
  if (!value.trim()) return null;
  const terms = value.trim().split(/\s+/);
  if (terms.length > 2) return null;
  const x = px(terms[0] ?? '');
  const y = px(terms[1] ?? terms[0] ?? '');
  return x === null || y === null ? null : { x, y };
}

/**
 * Read ordinary border paint only. Percent radii, border images, shadows and
 * outlines stay unavailable; a computed percentage is not a used pixel radius.
 * CSS's overlapping-radius scale is applied before deriving the inner curve.
 */
export function readBorderOutline(element: Element): BorderOutline {
  const win = element.ownerDocument.defaultView;
  if (!win) return { status: 'unsupported' };
  const css = win.getComputedStyle(element);
  if (
    (css.boxShadow && css.boxShadow !== 'none') ||
    (css.borderImageSource && css.borderImageSource !== 'none') ||
    (css.outlineStyle &&
      css.outlineStyle !== 'none' &&
      css.outlineStyle !== 'hidden' &&
      !transparent(css.outlineColor) &&
      css.outlineWidth !== '0px') ||
    ['transform', 'rotate', 'scale', 'translate'].some((key) => {
      const value = css.getPropertyValue(key);
      return value && value !== 'none';
    })
  )
    return { status: 'unsupported' };
  const sides = ['top', 'right', 'bottom', 'left'] as const;
  const widths = sides.map((side) => px(css.getPropertyValue(`border-${side}-width`)));
  const styles = sides.map((side) => css.getPropertyValue(`border-${side}-style`));
  const colors = sides.map((side) => css.getPropertyValue(`border-${side}-color`));
  if (widths.some((width) => width === null)) return { status: 'unsupported' };
  const painted = widths.some(
    (width, i) =>
      width! > 0 && styles[i] !== 'none' && styles[i] !== 'hidden' && !transparent(colors[i]!)
  );
  const base = JSON.stringify({ widths, styles, colors });
  if (!painted) return { status: 'clear', signature: base, blockClearance: { top: 0, bottom: 0 } };
  const outer = [
    css.borderTopLeftRadius,
    css.borderTopRightRadius,
    css.borderBottomRightRadius,
    css.borderBottomLeftRadius,
  ].map(radius);
  if (outer.some((corner) => corner === null)) return { status: 'unsupported' };
  const box = element.getBoundingClientRect();
  if (
    ![box.left, box.top, box.width, box.height].every(Number.isFinite) ||
    box.width <= 0 ||
    box.height <= 0
  )
    return { status: 'unsupported' };
  const [tl, tr, br, bl] = outer as [Corner, Corner, Corner, Corner];
  // Zero sums impose no constraint (rather than collapsing every radius).
  const scale = Math.min(
    1,
    ...(
      [
        [box.width, tl.x + tr.x],
        [box.width, bl.x + br.x],
        [box.height, tl.y + bl.y],
        [box.height, tr.y + br.y],
      ] as const
    )
      .filter(([, sum]) => sum > 0)
      .map(([extent, sum]) => extent / sum)
  );
  const [top, right, bottom, left] = widths as number[];
  const inset = (corner: Corner, x: number, y: number): Corner => ({
    x: Math.max(0, corner.x * scale - x),
    y: Math.max(0, corner.y * scale - y),
  });
  const corners = {
    tl: inset(tl, left!, top!),
    tr: inset(tr, right!, top!),
    br: inset(br, right!, bottom!),
    bl: inset(bl, left!, bottom!),
  };
  const dpr = win.devicePixelRatio;
  if (!Number.isFinite(dpr) || dpr <= 0) return { status: 'unsupported' };
  // A full device pixel past the corner tangent keeps the rectangle away from
  // the curved antialiasing fringe; this does not enlarge the optical ROI.
  const blockClearance = {
    top: Math.max(corners.tl.y, corners.tr.y) + 1 / dpr,
    bottom: Math.max(corners.bl.y, corners.br.y) + 1 / dpr,
  };
  const signature = JSON.stringify({ base, corners, dpr, blockClearance });
  return {
    status: 'border',
    signature,
    blockClearance,
    border: {
      bounds: {
        left: box.left + left!,
        top: box.top + top!,
        right: box.right - right!,
        bottom: box.bottom - bottom!,
      },
      corners,
      signature,
      blockClearance,
    },
  };
}

/** A rectangle is contained iff all four corners are in this convex shape. */
export function rectangleInsideBorder(rect: Bounds, border: PaintedBorder): boolean {
  const b = border.bounds;
  if (
    ![rect.left, rect.top, rect.right, rect.bottom, b.left, b.top, b.right, b.bottom].every(
      Number.isFinite
    ) ||
    rect.right < rect.left ||
    rect.bottom < rect.top ||
    rect.left < b.left ||
    rect.right > b.right ||
    rect.top < b.top ||
    rect.bottom > b.bottom
  )
    return false;
  const { tl, tr, br, bl } = border.corners;
  const inside = (x: number, y: number, corner: Corner, cx: number, cy: number) =>
    corner.x === 0 ||
    corner.y === 0 ||
    ((x - cx) / corner.x) ** 2 + ((y - cy) / corner.y) ** 2 <= 1;
  return (
    (rect.left >= b.left + tl.x ||
      rect.top >= b.top + tl.y ||
      inside(rect.left, rect.top, tl, b.left + tl.x, b.top + tl.y)) &&
    (rect.right <= b.right - tr.x ||
      rect.top >= b.top + tr.y ||
      inside(rect.right, rect.top, tr, b.right - tr.x, b.top + tr.y)) &&
    (rect.right <= b.right - br.x ||
      rect.bottom <= b.bottom - br.y ||
      inside(rect.right, rect.bottom, br, b.right - br.x, b.bottom - br.y)) &&
    (rect.left >= b.left + bl.x ||
      rect.bottom <= b.bottom - bl.y ||
      inside(rect.left, rect.bottom, bl, b.left + bl.x, b.bottom - bl.y))
  );
}
