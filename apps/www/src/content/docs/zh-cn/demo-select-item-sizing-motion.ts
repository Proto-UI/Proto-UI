/** Browser-only measurement, installed before the open action. Never changes motion or focus. */
export interface SizingMotionBox {
  width: number;
  height: number;
  layoutWidth: number;
  layoutHeight: number;
  border: number[];
  padding: number[];
  transform: number[];
  opacity: number;
}
export interface SizingMotionSample {
  at: number;
  owner: string;
  runtime: string;
  trigger: SizingMotionBox;
  content: SizingMotionBox;
  surface: SizingMotionBox;
  viewport: SizingMotionBox;
  items: SizingMotionBox[];
  animations: Array<{
    target: string;
    name: string | null;
    state: string;
    pending: boolean;
    currentTime: number | null;
    endTime: number;
  }>;
  focused: boolean;
}
export interface SizingMotionResult {
  status:
    | 'settled'
    | 'missing-animation'
    | 'interrupted'
    | 'deadline'
    | 'invalid-owner'
    | 'stopped'
    | 'frame-cap'
    | 'error';
  startedAt: number;
  endedAt: number;
  samples: SizingMotionSample[];
  error: string | null;
  cleanup: { frame: boolean; timer: boolean };
}
export interface SizingMotionHandle {
  done: Promise<SizingMotionResult>;
  stop(): void;
}
export type SizingMotionTrigger = HTMLElement & { __puiSizingMotion?: SizingMotionHandle };

// All runtime dependencies are inside this function: Playwright serializes it into the page.
export function installSizingMotionTrace(trigger: SizingMotionTrigger): SizingMotionHandle {
  trigger.__puiSizingMotion?.stop();
  const doc = trigger.ownerDocument;
  const win = doc.defaultView!;
  const owner = trigger.dataset.projectionOwner;
  const runtime = trigger.dataset.projectionRuntime;
  const startedAt = win.performance.now();
  const samples: SizingMotionSample[] = [];
  let frame: number | null = null;
  let timer: number | null = null;
  let finished = false;
  let opened = false;
  let idleFrames = 0;
  let frameCount = 0;
  let bound: HTMLElement[] | null = null;
  const seenAnimations = new Map<Animation, { target: string; name: string | null }>();
  const animationsByNode = new Map<HTMLElement, Set<Animation>>();
  let resolve!: (value: SizingMotionResult) => void;
  const done = new Promise<SizingMotionResult>((accept) => {
    resolve = accept;
  });
  const stop = (status: SizingMotionResult['status'], error: string | null = null) => {
    if (finished) return;
    finished = true;
    let frameClean = frame === null;
    let timerClean = timer === null;
    if (frame !== null) {
      try {
        win.cancelAnimationFrame(frame);
        frameClean = true;
      } catch (cause) {
        error = `${error === null ? '' : `${error}; `}cancelAnimationFrame failed: ${String(cause)}`;
      }
    }
    if (timer !== null) {
      try {
        win.clearTimeout(timer);
        timerClean = true;
      } catch (cause) {
        error = `${error === null ? '' : `${error}; `}clearTimeout failed: ${String(cause)}`;
      }
    }
    frame = null;
    timer = null;
    resolve({
      status: status === 'settled' && (!frameClean || !timerClean) ? 'error' : status,
      startedAt,
      endedAt: win.performance.now(),
      samples,
      error,
      cleanup: { frame: frameClean, timer: timerClean },
    });
  };
  const handle: SizingMotionHandle = { done, stop: () => stop('stopped') };
  trigger.__puiSizingMotion = handle;
  const box = (element: HTMLElement): SizingMotionBox => {
    const css = win.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    const border = [
      css.borderTopWidth,
      css.borderRightWidth,
      css.borderBottomWidth,
      css.borderLeftWidth,
    ].map(parseFloat);
    const padding = [css.paddingTop, css.paddingRight, css.paddingBottom, css.paddingLeft].map(
      parseFloat
    );
    const matrix =
      css.transform === 'none'
        ? [1, 0, 0, 1, 0, 0]
        : css.transform.startsWith('matrix(')
          ? css.transform.slice(7, -1).split(',').map(Number)
          : [];
    return {
      width: rect.width,
      height: rect.height,
      border,
      padding,
      transform: matrix,
      layoutWidth:
        parseFloat(css.width) +
        (css.boxSizing === 'border-box' ? 0 : padding[1] + padding[3] + border[1] + border[3]),
      layoutHeight:
        parseFloat(css.height) +
        (css.boxSizing === 'border-box' ? 0 : padding[0] + padding[2] + border[0] + border[2]),
      opacity: Number(css.opacity),
    };
  };
  const tick = () => {
    frame = null;
    if (finished) return;
    if (win.performance.now() - startedAt >= 1200) return stop('deadline');
    if (++frameCount > 96) return stop('frame-cap');
    try {
      if (
        !trigger.isConnected ||
        !owner ||
        !runtime ||
        trigger.dataset.projectionOwner !== owner ||
        trigger.dataset.projectionRuntime !== runtime
      )
        return stop('invalid-owner');
      if (trigger.getAttribute('aria-expanded') !== 'true') {
        if (opened) return stop('invalid-owner', 'Closed during this open-cycle trace');
        frame = win.requestAnimationFrame(tick);
        return;
      }
      const content = doc.getElementById(trigger.getAttribute('aria-controls') ?? '');
      if (!content) {
        if (opened) return stop('invalid-owner', 'Content disappeared during the open-cycle trace');
        frame = win.requestAnimationFrame(tick);
        return;
      }
      const one = (name: string) => {
        const nodes = content.querySelectorAll<HTMLElement>(
          `[data-projection-prototype="${name}"]`
        );
        if (nodes.length !== 1) throw new Error(`Expected one ${name}`);
        return nodes[0];
      };
      const surface = one('shadcn-select-surface');
      const viewport = one('shadcn-select-viewport');
      const items = [...content.querySelectorAll<HTMLElement>('[role="option"]')];
      const nodes = [content, surface, viewport, ...items];
      if (
        items.length !== 4 ||
        nodes.some((node) => !node.isConnected || node.dataset.projectionOwner !== owner) ||
        items.some((node) => !viewport.contains(node)) ||
        (bound && nodes.some((node, index) => node !== bound![index]))
      )
        return stop('invalid-owner');
      if (
        win.getComputedStyle(content).visibility === 'hidden' ||
        win.getComputedStyle(content).display === 'none' ||
        win.getComputedStyle(surface).visibility === 'hidden' ||
        win.getComputedStyle(surface).display === 'none'
      ) {
        if (opened)
          return stop(
            'invalid-owner',
            'Content or Surface became hidden during the open-cycle trace'
          );
        frame = win.requestAnimationFrame(tick);
        return;
      }
      bound = nodes;
      opened = true;
      // Observe all measured nodes, not only the Surface. Preserve Animation
      // objects after they disappear from getAnimations(), including cancellation.
      let missingAnimation: string | null = null;
      for (const [index, element] of [trigger, ...nodes].entries()) {
        const target = element.dataset.projectionPrototype ?? `node:${index}`;
        const observed = animationsByNode.get(element) ?? new Set<Animation>();
        animationsByNode.set(element, observed);
        for (const animation of element.getAnimations()) {
          observed.add(animation);
          const name =
            'animationName' in animation && typeof animation.animationName === 'string'
              ? animation.animationName
              : null;
          seenAnimations.set(animation, { target, name });
        }
        const css = win.getComputedStyle(element);
        const names = css.animationName.split(',').map((name) => name.trim());
        const durations = css.animationDuration.split(',').map(parseFloat);
        for (const [i, name] of names.entries()) {
          if (
            name &&
            name !== 'none' &&
            durations[i % durations.length] > 0 &&
            ![...observed].some((animation) => seenAnimations.get(animation)?.name === name)
          )
            missingAnimation = `${target}: declared ${name} was never observed`;
        }
      }
      const animations = [...seenAnimations].map(([animation, identity]) => ({
        ...identity,
        state: animation.playState,
        pending: animation.pending,
        currentTime: typeof animation.currentTime === 'number' ? animation.currentTime : null,
        endTime: Number(animation.effect?.getComputedTiming().endTime ?? NaN),
      }));
      const focused = items.includes(doc.activeElement as HTMLElement);
      // Every box and animation is read in the same callback, with one timestamp.
      samples.push({
        at: win.performance.now(),
        owner,
        runtime,
        trigger: box(trigger),
        content: box(content),
        surface: box(surface),
        viewport: box(viewport),
        items: items.map(box),
        animations,
        focused,
      });
      if (missingAnimation) return stop('missing-animation', missingAnimation);
      // This is an animation-state prerequisite, NOT a size/transform-until-green poll.
      // Paused, pending and running animations cannot establish settlement.
      if (animations.some((animation) => animation.state === 'idle'))
        return stop('interrupted', 'Observed animation was cancelled before settlement');
      const idle = animations.every(
        (animation) => !animation.pending && animation.state === 'finished'
      );
      idleFrames = idle && focused ? idleFrames + 1 : 0;
      if (idleFrames === 2) return stop('settled');
      frame = win.requestAnimationFrame(tick);
    } catch (error) {
      stop('error', String(error));
    }
  };
  timer = win.setTimeout(() => stop('deadline'), 1200);
  frame = win.requestAnimationFrame(tick);
  // Callers retain this exact trace across DOM replacement. The trace itself
  // still rejects a detached/replaced owner rather than following its successor.
  return handle;
}

/** Independent checks on the retained whole trajectory, not a selected successful frame. */
export function sizingMotionIssues(result: SizingMotionResult, runtime: string): string[] {
  const issues: string[] = [];
  if (result.status !== 'settled') issues.push(`trace ${result.status}: ${result.error ?? ''}`);
  if (!result.cleanup.frame || !result.cleanup.timer) issues.push('trace cleanup incomplete');
  if (result.samples.length < 2) issues.push('missing trajectory');
  let previous = -Infinity;
  const near = (a: number, b: number, tolerance = 0.5) =>
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
  const identity = (value: number[]) =>
    value.length === 6 && value.every((x, i) => near(x, [1, 0, 0, 1, 0, 0][i], 0.000001));
  for (const sample of result.samples) {
    if (
      !Number.isFinite(sample.at) ||
      sample.at < previous ||
      !sample.owner ||
      sample.owner !== result.samples[0].owner ||
      sample.runtime !== runtime ||
      sample.items.length !== 4
    )
      issues.push('sample identity/time');
    previous = sample.at;
    const matrix = sample.surface.transform;
    const scale = matrix[0];
    if (
      matrix.length !== 6 ||
      !near(matrix[3], scale, 0.000001) ||
      ![1, 2, 4, 5].every((i) => near(matrix[i], 0, 0.000001)) ||
      !(scale >= 0.95 - 0.00001 && scale <= 1 + 0.00001)
    )
      issues.push('unexpected Surface transform');
    if (
      ![sample.trigger, sample.content, sample.viewport, ...sample.items].every((item) =>
        identity(item.transform)
      )
    )
      issues.push('unexpected additional transform');
    // #1330 retired the row border-box lease. The popup matches the Trigger;
    // rows are full-width flow children inside group chrome (rhea p-1 is 8px).
    if (
      !near(sample.content.layoutWidth, sample.trigger.layoutWidth) ||
      !near(sample.surface.layoutWidth, sample.trigger.layoutWidth)
    )
      issues.push('popup width is not the trigger');
    for (const item of sample.items) {
      const inset = sample.trigger.layoutWidth - item.layoutWidth;
      if (!near(item.layoutHeight, sample.trigger.layoutHeight) || inset < -0.5 || inset > 8.5)
        issues.push('layout mismatch during motion');
      if (
        !near(item.width, item.layoutWidth * scale) ||
        !near(item.height, item.layoutHeight * scale)
      )
        issues.push('paint not explained by Surface scale');
    }
  }
  for (const sample of result.samples.slice(-2)) {
    if (!identity(sample.surface.transform)) issues.push('non-unit settled scale');
    if (!near(sample.surface.opacity, 1, 0.000001)) issues.push('non-unit settled opacity');
    if (!sample.focused || sample.animations.some((a) => a.pending || a.state !== 'finished'))
      issues.push('unsettled endpoint');
  }
  return issues;
}
