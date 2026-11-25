import {
  assertLiquidHoverContextReframeEligibility,
  liquidHoverContextCapture,
  liquidHoverContextReframe,
} from './liquid-hover-fixture';

export type ScreenshotRect = { x: number; y: number; width: number; height: number };
export type ScreenshotFrame = {
  subject: ScreenshotRect;
  viewport: { width: number; height: number };
  scroll: { x: number; y: number };
};
export type LiquidHoverGeometry = ScreenshotFrame;
export type LiquidHoverFrame = ScreenshotFrame & {
  states: Record<string, unknown>;
  requests: unknown;
  material: { quality: unknown; contact: unknown; carrier: unknown; paintOutset: number };
};
export type LiquidHoverFramingEvidence = {
  boundary: string;
  before?: LiquidHoverFrame;
  after?: LiquidHoverFrame;
  actions: Array<{ kind: 'scroll-into-view' | 'scroll-by'; delta?: { x: number; y: number } }>;
  failure?: string;
  attempts?: LiquidHoverIdleAttempt[];
};
export type LiquidHoverIdleAttempt = {
  number: number;
  setup: LiquidHoverFramingEvidence;
  reads: LiquidHoverFrame[];
  ready?: LiquidHoverFrame;
  observed?: LiquidHoverFrame;
  materialGeometry?: ScreenshotRect;
  materialPaintOutset?: number;
  accepted: boolean;
  failure?: string;
};
export type LiquidHoverFramingIO = {
  readFrame(): Promise<LiquidHoverFrame>;
  scrollIntoView(): Promise<unknown>;
  scrollBy(delta: { x: number; y: number }): Promise<unknown>;
  settleFrames(): Promise<unknown>;
};
export type LiquidHoverIdleIO<T> = LiquidHoverFramingIO & {
  settleMaterial(remainingMilliseconds: number): Promise<unknown>;
  observeMaterial(): Promise<{ value: T; geometry: ScreenshotRect; paintOutset: number }>;
  now?(): number;
};

export async function observeLiquidHoverIdle<T>(
  io: LiquidHoverIdleIO<T>,
  evidence: LiquidHoverFramingEvidence
): Promise<T> {
  // Four complete attempts bound test evidence acquisition, not component
  // behavior. A stable setup is never a lease across an awaited readiness or
  // image decode. Every failed geometry attempt remains in the receipt.
  evidence.attempts = [];
  const now = io.now ?? (() => performance.now());
  const deadline = now() + 8000;
  const remaining = () => {
    const value = deadline - now();
    if (!Number.isFinite(value) || value <= 0)
      throw new Error('Idle material capture exceeded the existing 8000ms readiness budget');
    return value;
  };
  let baseline: LiquidHoverFrame | undefined;
  let attempt: LiquidHoverIdleAttempt | undefined;
  try {
    for (let number = 1; number <= 4; number++) {
      remaining();
      attempt = {
        number,
        setup: { boundary: evidence.boundary, actions: [] },
        reads: [],
        accepted: false,
      };
      evidence.attempts.push(attempt);
      const readFrame = async () => {
        const frame = copy(await io.readFrame());
        attempt!.reads.push(frame);
        evidence.after = copy(frame);
        remaining();
        validateFrame(frame);
        baseline ??= copy(frame);
        evidence.before ??= copy(baseline);
        assertFramingPreserves(baseline, frame);
        return frame;
      };
      const readEligibleFrame = async () => {
        let frame = await readFrame();
        const initial = eligibility(frame, evidence.boundary);
        if (
          number === 1 &&
          attempt!.reads.length === 1 &&
          (initial.boundary === 'reenabled-item' ||
            initial.boundary === 'reenabled-owner' ||
            initial.boundary === 'reenabled-subject') &&
          frame.states.disabled === false &&
          initial.hovered === false &&
          initial.pressed === false &&
          initial.focused === false &&
          initial.focusVisible === false &&
          initial.quality === 'opaque-fallback' &&
          initial.contact === 'held' &&
          initial.carrier === null
        ) {
          // The Base owner has re-enabled, but the provider has not yet rebound
          // the optical receipt. Observe recovery before any viewport action.
          await io.settleMaterial(remaining());
          frame = await readFrame();
        }
        assertLiquidHoverContextReframeEligibility(eligibility(frame, evidence.boundary));
        return frame;
      };
      let prepared: LiquidHoverFrame;
      try {
        prepared = await prepareLiquidHoverFrame(
          { ...io, readFrame: readEligibleFrame },
          attempt.setup
        );
      } finally {
        evidence.actions.push(...attempt.setup.actions);
      }
      await io.settleMaterial(remaining());
      remaining();
      attempt.ready = await readEligibleFrame();
      const sameGeometry = (left: ScreenshotFrame, right: ScreenshotFrame) =>
        equal(left.subject, right.subject) &&
        equal(left.viewport, right.viewport) &&
        equal(left.scroll, right.scroll);
      if (!sameGeometry(prepared, attempt.ready)) {
        attempt.failure = 'Idle geometry moved during material readiness';
        continue;
      }
      const material = await io.observeMaterial();
      remaining();
      attempt.materialGeometry = copy(material.geometry);
      attempt.materialPaintOutset = material.paintOutset;
      attempt.observed = await readEligibleFrame();
      if (
        !sameGeometry(attempt.ready, attempt.observed) ||
        !equal(material.geometry, attempt.observed.subject)
      ) {
        attempt.failure = 'Idle geometry moved during material observation';
        continue;
      }
      if (
        !liquidHoverContextCapture(
          attempt.observed.subject,
          attempt.observed.viewport,
          material.paintOutset
        ).fullyPadded
      ) {
        attempt.failure = 'Fresh material requires additional screenshot context';
        continue;
      }
      attempt.accepted = true;
      return material.value;
    }
    throw new Error('Idle material capture did not stabilize within four attempts');
  } catch (error) {
    if (attempt) attempt.failure = errorText(error);
    evidence.failure = errorText(error);
    throw error;
  }
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));
const copy = <T>(value: T): T => structuredClone(value);

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(right, key) &&
        equal((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key])
    )
  );
}

function validateFrame(frame: ScreenshotFrame) {
  const { subject, viewport, scroll } = frame;
  if (
    ![...Object.values(subject), ...Object.values(viewport), ...Object.values(scroll)].every(
      Number.isFinite
    ) ||
    subject.width <= 0 ||
    subject.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  )
    throw new Error('Invalid screenshot frame geometry');
}

function insideViewport({ subject, viewport }: ScreenshotFrame) {
  return (
    subject.x >= 0 &&
    subject.y >= 0 &&
    subject.x + subject.width <= viewport.width &&
    subject.y + subject.height <= viewport.height
  );
}

function eligibility(frame: LiquidHoverFrame, boundary: string) {
  return {
    boundary,
    hovered: frame.states.hovered,
    pressed: frame.states.pressed,
    focused: frame.states.focused,
    focusVisible: frame.states.focusVisible,
    contact: frame.material.contact,
    quality: frame.material.quality,
    carrier: frame.material.carrier,
  };
}

function assertFramingPreserves(before: LiquidHoverFrame, after: LiquidHoverFrame) {
  validateFrame(after);
  if (!equal(before.states, after.states)) throw new Error('Framing changed Base states');
  if (!equal(before.requests, after.requests)) throw new Error('Framing changed semantic requests');
  if (
    !equal(before.viewport, after.viewport) ||
    before.subject.width !== after.subject.width ||
    before.subject.height !== after.subject.height ||
    before.subject.x + before.scroll.x !== after.subject.x + after.scroll.x ||
    before.subject.y + before.scroll.y !== after.subject.y + after.scroll.y
  )
    throw new Error('Framing changed document layout');
}

/**
 * Test-only setup at an explicitly verified idle boundary. Every scroll is
 * followed by a real read; neither a planned delta nor translated geometry is
 * evidence that the browser applied it. This owns no component input or state.
 */
export async function prepareLiquidHoverFrame(
  io: LiquidHoverFramingIO,
  evidence: LiquidHoverFramingEvidence
): Promise<LiquidHoverFrame> {
  try {
    const before = (evidence.before = copy(await io.readFrame()));
    let current = (evidence.after = copy(before));
    validateFrame(current);
    assertLiquidHoverContextReframeEligibility(eligibility(current, evidence.boundary));
    const resample = async () => {
      await io.settleFrames();
      current = evidence.after = copy(await io.readFrame());
      assertFramingPreserves(before, current);
      assertLiquidHoverContextReframeEligibility(eligibility(current, evidence.boundary));
    };
    if (!insideViewport(current)) {
      evidence.actions.push({ kind: 'scroll-into-view' });
      await io.scrollIntoView();
      await resample();
    }
    const context = liquidHoverContextCapture(
      current.subject,
      current.viewport,
      current.material.paintOutset
    );
    const adjustment = liquidHoverContextReframe(context, eligibility(current, evidence.boundary));
    if (adjustment.needed) {
      evidence.actions.push({ kind: 'scroll-by', delta: copy(adjustment.delta) });
      await io.scrollBy(adjustment.delta);
      await resample();
    }
    if (
      !liquidHoverContextCapture(current.subject, current.viewport, current.material.paintOutset)
        .fullyPadded
    )
      throw new Error('Neutral viewport setup still lacks screenshot context');
    return current;
  } catch (error) {
    evidence.failure = errorText(error);
    throw error;
  }
}

export type LiquidHoverCaptureIO<T> = {
  readGeometry(): Promise<ScreenshotFrame>;
  /**
   * Use Page.screenshot({ clip }) with fullPage absent/false. clip is CSS
   * viewport-relative: Playwright adds the current document scroll internally.
   * Do not add scroll offsets, use Locator.screenshot, or change animations.
   */
  screenshotViewportClip(kind: 'root' | 'context', clip: ScreenshotRect): Promise<T>;
};
export type LiquidHoverClipReceipt<T> = {
  clip?: ScreenshotRect;
  bytes?: T;
  errors: string[];
};
export type LiquidHoverGeometryCheck = {
  phase: 'before-root' | 'between' | 'after-context';
  actual?: ScreenshotFrame;
  errors: string[];
};
export type LiquidHoverCaptureReceipt<T> = {
  frozenFrame: ScreenshotFrame;
  root: LiquidHoverClipReceipt<T>;
  context: LiquidHoverClipReceipt<T> & {
    geometry?: ReturnType<typeof liquidHoverContextCapture>;
  };
  geometryChecks: LiquidHoverGeometryCheck[];
  errors: string[];
};

/** Exact integer enclosure; a partially visible root is a failure, not a pass. */
function rootClip(frame: ScreenshotFrame): ScreenshotRect {
  validateFrame(frame);
  if (!insideViewport(frame)) throw new Error('Root subject is outside the viewport');
  const { subject, viewport } = frame;
  const left = Math.floor(subject.x);
  const top = Math.floor(subject.y);
  const right = Math.ceil(subject.x + subject.width);
  const bottom = Math.ceil(subject.y + subject.height);
  if (right > viewport.width || bottom > viewport.height)
    throw new Error('Root integer enclosure is outside the viewport');
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Observational capture has no scrolling capability. Preserve both independent
 * diagnostic crops and every failure, even if framing/readiness already failed
 * or either screenshot throws. Any geometry drift invalidates acceptance; its
 * pixels may still diagnose the failure and never replace the frozen receipt.
 */
export async function captureLiquidHoverClips<T>(
  io: LiquidHoverCaptureIO<T>,
  frozenGeometry: ScreenshotFrame,
  paintOutset = 0
): Promise<LiquidHoverCaptureReceipt<T>> {
  const frozenFrame = copy(frozenGeometry);
  const result: LiquidHoverCaptureReceipt<T> = {
    frozenFrame,
    root: { errors: [] },
    context: { errors: [] },
    geometryChecks: [],
    errors: [],
  };
  const failure = (errors: string[], error: unknown) => {
    const message = errorText(error);
    errors.push(message);
    result.errors.push(message);
  };
  try {
    result.root.clip = rootClip(frozenFrame);
  } catch (error) {
    failure(result.root.errors, error);
  }
  try {
    result.context.geometry = liquidHoverContextCapture(
      frozenFrame.subject,
      frozenFrame.viewport,
      paintOutset
    );
    result.context.clip = copy(result.context.geometry.clip);
    if (!result.context.geometry.fullyPadded)
      failure(result.context.errors, 'Native context crop lacks required surrounding pixels');
  } catch (error) {
    failure(result.context.errors, error);
  }
  const check = async (phase: LiquidHoverGeometryCheck['phase']) => {
    const receipt: LiquidHoverGeometryCheck = { phase, errors: [] };
    result.geometryChecks.push(receipt);
    try {
      const actual = (receipt.actual = copy(await io.readGeometry()));
      validateFrame(actual);
      for (const field of ['subject', 'viewport', 'scroll'] as const)
        if (!equal(frozenFrame[field], actual[field]))
          failure(receipt.errors, `${phase}: frozen ${field} geometry changed`);
    } catch (error) {
      failure(receipt.errors, `${phase}: ${errorText(error)}`);
    }
  };
  const screenshot = async (kind: 'root' | 'context') => {
    const receipt = result[kind];
    if (!receipt.clip) return;
    try {
      receipt.bytes = await io.screenshotViewportClip(kind, copy(receipt.clip));
    } catch (error) {
      failure(receipt.errors, `${kind} screenshot: ${errorText(error)}`);
    }
  };
  await check('before-root');
  await screenshot('root');
  await check('between');
  await screenshot('context');
  await check('after-context');
  return result;
}
