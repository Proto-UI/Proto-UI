import type { Locator, Page } from 'playwright-core';

// CSS <number> includes exponent notation. Preserve tiny real samples rather
// than rounding/dropping endpoint-adjacent frames from Chromium's serialization.
const CSS_NUMBER = String.raw`[+-]?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?`;
export const BUTTON_SHADOW_PATTERN = String.raw`^rgba?\((${CSS_NUMBER}(?:\s*,\s*${CSS_NUMBER}){2}(?:\s*,\s*${CSS_NUMBER})?)\)\s+(${CSS_NUMBER})px\s+(${CSS_NUMBER})px\s+(${CSS_NUMBER})px\s+(${CSS_NUMBER})px$`;

export interface ButtonMotionFrame {
  time: number;
  connected: boolean;
  x: number;
  y: number;
  shadow: string;
  shadowX: number;
  shadowY: number;
  shadowAlpha: number;
  shadowBlur: number;
  shadowSpread: number;
  property: string;
  duration: string;
  easing: string;
  transformTime: number | null;
  shadowTime: number | null;
  pressed: boolean;
}

/** Real rAF samples, not emulated time, repeated activation, or a CSS substitute. */
export async function recordButtonMotion(
  page: Page,
  subject: Locator,
  direction: 'enter' | 'release'
): Promise<{ frames: ButtonMotionFrame[]; error: string | null }> {
  const probe = await subject.evaluateHandle((element, shadowPattern) => {
    const result: { frames: ButtonMotionFrame[]; error: string | null } = {
      frames: [],
      error: null,
    };
    const frames = result.frames;
    let finish!: () => void;
    const done = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const start = performance.now();
    const sample = () => {
      try {
        const style = getComputedStyle(element);
        const matrix = new DOMMatrixReadOnly(
          style.transform === 'none' ? undefined : style.transform
        );
        const lastShadow = style.boxShadow
          .split(/,(?![^()]*\))/)
          .at(-1)!
          .trim();
        const shadow = lastShadow === 'none' ? null : lastShadow.match(new RegExp(shadowPattern));
        if (lastShadow !== 'none' && !shadow)
          throw new Error(`Unrecognized computed shadow: ${style.boxShadow}`);
        const color = shadow?.[1]
          .split(/[\s,/]+/)
          .filter(Boolean)
          .map(Number);
        if (
          shadow &&
          color &&
          (![...color, ...shadow.slice(2).map(Number)].every(Number.isFinite) ||
            color.slice(0, 3).some((channel) => channel < 0 || channel > 255) ||
            (color[3] !== undefined && (color[3] < 0 || color[3] > 1)))
        )
          throw new Error(`Non-finite or invalid computed shadow: ${style.boxShadow}`);
        const timeFor = (property: string) => {
          const animation = element
            .getAnimations()
            .find(
              (animation) =>
                (animation as Animation & { transitionProperty?: string }).transitionProperty ===
                property
            );
          return typeof animation?.currentTime === 'number' ? animation.currentTime : null;
        };
        frames.push({
          time: performance.now() - start,
          connected: element.isConnected,
          x: matrix.m41,
          y: matrix.m42,
          shadow: style.boxShadow,
          shadowX: shadow ? Number(shadow[2]) : 0,
          shadowY: shadow ? Number(shadow[3]) : 0,
          shadowBlur: shadow ? Number(shadow[4]) : 0,
          shadowSpread: shadow ? Number(shadow[5]) : 0,
          shadowAlpha: color ? (color[3] ?? 1) : 0,
          property: style.transitionProperty,
          duration: style.transitionDuration,
          easing: style.transitionTimingFunction,
          transformTime: timeFor('transform'),
          shadowTime: timeFor('box-shadow'),
          pressed: element.hasAttribute('data-pressed'),
        });
        if (performance.now() - start < 450) requestAnimationFrame(sample);
        else finish();
      } catch (error) {
        result.error = String(error);
        finish();
      }
    };
    sample();
    return { result, done };
  }, BUTTON_SHADOW_PATTERN);
  try {
    if (direction === 'enter') {
      const box = await subject.boundingBox();
      if (!box) throw new Error('Motion subject has no rendered bounds');
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
    } else {
      await page.mouse.up();
      await page.mouse.move(0, 0);
    }
    await probe.evaluate((probe) => probe.done);
    return await probe.evaluate((probe) => probe.result);
  } finally {
    await probe.dispose();
  }
}

function cubic(progress: number): number {
  // CSS cubic-bezier(.4,0,.2,1): solve x(t), then evaluate y(t).
  let lo = 0,
    hi = 1;
  for (let index = 0; index < 30; index++) {
    const t = (lo + hi) / 2;
    const x = 3 * (1 - t) ** 2 * t * 0.4 + 3 * (1 - t) * t ** 2 * 0.2 + t ** 3;
    if (x < progress) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return 3 * (1 - t) * t ** 2 + t ** 3;
}

export function buttonMotionIssues(
  frames: ButtonMotionFrame[],
  direction: 'enter' | 'release',
  distance: number,
  reduced: boolean
): string[] {
  const issues: string[] = [];
  if (
    frames.some(
      (frame) =>
        ![
          frame.time,
          frame.x,
          frame.y,
          frame.shadowX,
          frame.shadowY,
          frame.shadowBlur,
          frame.shadowSpread,
          frame.shadowAlpha,
          ...(frame.transformTime === null ? [] : [frame.transformTime]),
          ...(frame.shadowTime === null ? [] : [frame.shadowTime]),
        ].every(Number.isFinite)
    )
  )
    return ['non-finite motion observation'];
  if (frames.length < 3) return ['insufficient real frames'];
  const near = (actual: number, expected: number, tolerance = 0.025) =>
    Math.abs(actual - expected) <= tolerance;
  const progress = (frame: ButtonMotionFrame) =>
    direction === 'enter' ? frame.x / distance : 1 - frame.x / distance;
  const middle = frames.filter((frame) => progress(frame) > 0.02 && progress(frame) < 0.98);
  if (!near(progress(frames[0]!), 0) || !near(progress(frames.at(-1)!), 1))
    issues.push('incorrect transform endpoints');
  const shadowProgress = (frame: ButtonMotionFrame) =>
    direction === 'enter' ? 1 - frame.shadowX / 4 : frame.shadowX / 4;
  if (!near(shadowProgress(frames[0]!), 0) || !near(shadowProgress(frames.at(-1)!), 1))
    issues.push('incorrect shadow endpoints');
  if (!reduced && new Set(middle.map((frame) => frame.x.toFixed(3))).size < 2)
    issues.push('missing transform intermediate frames');
  if (
    !reduced &&
    new Set(
      frames
        .filter((frame) => shadowProgress(frame) > 0.02 && shadowProgress(frame) < 0.98)
        .map((frame) => frame.shadowX.toFixed(3))
    ).size < 2
  )
    issues.push('missing shadow intermediate frames');
  let previous = 0;
  for (const frame of frames) {
    if (frame.shadowBlur !== 0 || frame.shadowSpread !== 0)
      issues.push('shadow is not the hard zero-blur/zero-spread family paint');
    if (!frame.connected) issues.push('subject replaced during motion');
    if (!near(frame.x, frame.y) || !near(frame.shadowX, frame.shadowY))
      issues.push('unequal axis motion');
    if (progress(frame) + 0.01 < previous) issues.push('non-monotonic transform');
    previous = progress(frame);
    if (!near(frame.shadowAlpha, frame.shadowX / 4, 0.035))
      issues.push('shadow alpha does not interpolate with offset');
    if (reduced) {
      if (frame.property !== 'none' || frame.transformTime !== null || frame.shadowTime !== null)
        issues.push('reduced motion has an active timing writer');
      if (
        ![0, 1].some((end) => near(progress(frame), end)) ||
        ![0, 1].some((end) => near(shadowProgress(frame), end))
      )
        issues.push('reduced motion interpolates');
      continue;
    }
    if (
      frame.property !== 'all' ||
      frame.duration !== '0.15s' ||
      frame.easing !== 'cubic-bezier(0.4, 0, 0.2, 1)'
    )
      issues.push('incorrect CSS timing contract');
    if (progress(frame) > 0.02 && progress(frame) < 0.98) {
      if (
        frame.transformTime === null ||
        !near(progress(frame), cubic(frame.transformTime / 150), 0.035)
      )
        issues.push('transform differs from declared easing');
    }
    if (shadowProgress(frame) > 0.02 && shadowProgress(frame) < 0.98) {
      if (
        frame.shadowTime === null ||
        !near(shadowProgress(frame), cubic(frame.shadowTime / 150), 0.035)
      )
        issues.push('shadow differs from declared easing');
    }
  }
  return [...new Set(issues)];
}
