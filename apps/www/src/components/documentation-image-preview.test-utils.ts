// Test-only geometry for a native pointer probe shared by source and preview.
type Rect = { x: number; y: number; width: number; height: number };

// The admitted documentation zoom is a 420ms damped spring. These checks use
// observed geometry and a separate linear scrim clock, never the authored CSS
// stop list as their expected result.
export const IMAGE_MOTION_DURATION_MS = 420;
export const IMAGE_SPRING_MAX_SLOPE = 4;
export type ImageMotionFrame = Rect & {
  time: number;
  phase: string | null;
  opacity: number;
  sourceOpacity: number | null;
};
const motionAxes = ['x', 'y', 'width', 'height'] as const;

export function imageSpringMotionFailures(
  frames: ImageMotionFrame[],
  origin: Rect,
  target: Rect,
  direction: 'opening' | 'closing'
): string[] {
  const failures: string[] = [];
  if ([origin, target].some((rect) => motionAxes.some((key) => !Number.isFinite(rect[key]))))
    return ['Motion endpoints must have finite geometry'];
  const axis = motionAxes.reduce((best, key) =>
    Math.abs(target[key] - origin[key]) > Math.abs(target[best] - origin[best]) ? key : best
  );
  const distance = target[axis] - origin[axis];
  if (Math.abs(distance) < 1) return ['Motion requires a measurable source-to-target path'];
  const phase = direction === 'opening' ? 'entering' : 'leaving';
  const moving = frames.filter((frame) => frame.phase === phase);
  const middle = moving.filter((frame) => frame.opacity > 0.1 && frame.opacity < 0.9);
  if (moving.length < 2 || middle.length < 2)
    failures.push('Motion must include actual intermediate transition frames');
  if (moving.some((frame) => frame.sourceOpacity !== 0))
    failures.push('The source must stay hidden throughout the image flight');
  const progress = (frame: ImageMotionFrame) => {
    const geometric = (frame[axis] - origin[axis]) / distance;
    return direction === 'opening' ? geometric : 1 - geometric;
  };
  for (const frame of frames) {
    if (
      [frame.time, frame.opacity, ...motionAxes.map((key) => frame[key])].some(
        (value) => !Number.isFinite(value)
      )
    ) {
      failures.push('Motion samples must be finite');
      continue;
    }
    const geometric = (frame[axis] - origin[axis]) / distance;
    for (const key of motionAxes)
      if (Math.abs(frame[key] - (origin[key] + (target[key] - origin[key]) * geometric)) >= 4)
        failures.push(`${key} left the measured source-to-target path`);
    if (progress(frame) < -0.01 || progress(frame) > 1.05)
      failures.push('The spring exceeded its bounded five-percent overshoot');
  }
  const peak = Math.max(...moving.map(progress));
  if (!(peak > 1.01)) failures.push('The image must exhibit a measurable spring overshoot');
  const peakIndex = moving.findIndex((frame) => progress(frame) === peak);
  for (let index = peakIndex + 1; index > 0 && index < moving.length; index++)
    if (Math.abs(progress(moving[index]) - 1) > Math.abs(progress(moving[index - 1]) - 1) + 0.005)
      failures.push('The spring must converge after its overshoot');
  if (
    !middle.some((frame) => {
      const clock = direction === 'opening' ? frame.opacity : 1 - frame.opacity;
      return clock >= 0.15 && clock <= 0.4 && progress(frame) > clock + 0.15;
    })
  )
    failures.push('The spring must advance ahead of the linear scrim during its initial approach');
  const sign = direction === 'opening' ? 1 : -1;
  for (let index = 1; index < middle.length; index++) {
    const first = middle[0];
    const frame = middle[index];
    if (
      frame.time <= middle[index - 1].time ||
      Math.abs(
        frame.opacity -
          first.opacity -
          (sign * (frame.time - first.time)) / IMAGE_MOTION_DURATION_MS
      ) >= 0.025
    )
      failures.push('The scrim must retain its independent 420ms linear clock');
  }
  const last = frames.at(-1);
  const endpoint = direction === 'opening' ? target : origin;
  if (!last || motionAxes.some((key) => Math.abs(last[key] - endpoint[key]) >= 4))
    failures.push('The spring must settle at the measured endpoint');
  if (last && !(Math.abs(progress(last) - 1) < (peak - 1) / 2))
    failures.push('The spring must damp its overshoot before finishing');
  return [...new Set(failures)];
}

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
