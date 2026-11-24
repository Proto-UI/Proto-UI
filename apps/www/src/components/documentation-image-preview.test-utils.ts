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

type PaintRect = Rect & { top: number; right: number; bottom: number; left: number };
export type KeyboardClosePaint = {
  text: string | null;
  active: boolean;
  nativeFocusVisible: boolean;
  dataFocusVisible: string | null;
  box: PaintRect;
  textBox: PaintRect;
  style: {
    foregroundRgba: number[];
    backgroundRgba: number[];
    opacity: string;
    visibility: string;
    clipPath: string;
  };
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  ancestors: Array<{
    tag: string;
    box: PaintRect;
    client: { left: number; top: number; width: number; height: number };
    overflowX: string;
    overflowY: string;
    clipPath: string;
    clip: string;
    maskImage: string;
    transform: string;
  }>;
};

/** Page-specific small-label acceptance, not a family-wide palette guarantee. */
export function keyboardCloseContrast(facts: KeyboardClosePaint): number | null {
  const foreground = facts.style.foregroundRgba;
  const background = facts.style.backgroundRgba;
  // An unknown image behind a transparent control cannot supply a reliable pair.
  if (foreground[3] !== 255 || background[3] !== 255) return null;
  const luminance = (rgba: number[]) => {
    const rgb = rgba.slice(0, 3).map((channel) => {
      const value = channel / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
  };
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

/** Check actual native Range/paint/overflow observations, including early frames. */
export function keyboardClosePaintFailures(facts: KeyboardClosePaint): string[] {
  const failures: string[] = [];
  if (!facts.active || !facts.nativeFocusVisible || facts.dataFocusVisible === null)
    failures.push('Close must retain actual keyboard focus and visible focus facts');
  if (!facts.text?.trim() || facts.textBox.width <= 0 || facts.textBox.height <= 0)
    failures.push('Close must render its label');
  if (
    facts.style.clipPath !== 'none' ||
    facts.style.visibility !== 'visible' ||
    Number(facts.style.opacity) !== 1
  )
    failures.push('The focused Close label must be painted');
  const contrast = keyboardCloseContrast(facts);
  if (contrast === null)
    failures.push('Close needs an opaque foreground/background pair over images');
  else if (contrast < 4.5) failures.push(`Close small-label contrast is ${contrast}, below 4.5`);

  // Half a CSS pixel accounts for integer client metrics without accepting a
  // visibly clipped line. Every failure names the actual boundary that clips it.
  const checkBounds = (
    name: string,
    bounds: { left: number; right: number; top: number; bottom: number },
    x = true,
    y = true
  ) => {
    const text = facts.textBox;
    if (x && (text.left < bounds.left - 0.5 || text.right > bounds.right + 0.5))
      failures.push(`Close text exceeds ${name} horizontally`);
    if (y && (text.top < bounds.top - 0.5 || text.bottom > bounds.bottom + 0.5))
      failures.push(`Close text exceeds ${name} vertically`);
  };
  checkBounds('its opaque button', facts.box);
  checkBounds('the viewport', {
    left: 0,
    top: 0,
    right: facts.viewport.width,
    bottom: facts.viewport.height,
  });
  for (const ancestor of facts.ancestors) {
    if (ancestor.clipPath !== 'none' || ancestor.clip !== 'auto' || ancestor.maskImage !== 'none')
      failures.push(`Close text has a clipping/masking ancestor: ${ancestor.tag}`);
    if (ancestor.transform !== 'none') {
      failures.push(`Close overflow evidence needs untransformed bounds: ${ancestor.tag}`);
      continue;
    }
    const clips = (overflow: string) => ['auto', 'scroll', 'hidden', 'clip'].includes(overflow);
    if (!clips(ancestor.overflowX) && !clips(ancestor.overflowY)) continue;
    const left = ancestor.box.left + ancestor.client.left;
    const top = ancestor.box.top + ancestor.client.top;
    checkBounds(
      `${ancestor.tag} scrollport`,
      {
        left,
        top,
        right: left + ancestor.client.width,
        bottom: top + ancestor.client.height,
      },
      clips(ancestor.overflowX),
      clips(ancestor.overflowY)
    );
  }
  return failures;
}
