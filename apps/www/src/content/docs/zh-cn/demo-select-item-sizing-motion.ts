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
  alignedIndex: number;
  selectedIndices: number[];
  disabledIndices: number[];
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
export type SizingMotionSelection = 'unset' | 'selected';
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
  selection: SizingMotionSelection;
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
export interface SizingPublicOwnerBinding {
  readonly owner: string;
  readonly runtime: string;
  readonly itemCount: number;
  isCurrent(): boolean;
  owns(node: HTMLElement): boolean;
  read(): {
    content: HTMLElement;
    surface: HTMLElement;
    viewport: HTMLElement;
    items: HTMLElement[];
  };
}
export type SizingMotionTrigger = HTMLElement & {
  __puiSizingMotion?: SizingMotionHandle;
  __puiSizingOwner?: SizingPublicOwnerBinding;
};

/** Bind the ordinary public DemoRenderer through its actual owner transport and
 * committed controller. This journal observes DOM identity; it writes no app state. */
export function installSizingPublicOwner(
  trigger: SizingMotionTrigger,
  input: { demoId: string; itemCount: number }
): { owner: string; runtime: string; itemCount: number } {
  // Keep every runtime dependency inside this function for page serialization.
  type Previewer = HTMLElement & {
    __previewer__?: { getCurrentRuntime?: () => string | null };
  };
  const { demoId, itemCount } = input;
  const doc = trigger.ownerDocument;
  const controls = trigger.getAttribute('aria-controls');
  const previewer = trigger.closest<Previewer>('[data-demo-id]');
  const controller = previewer?.__previewer__;
  const runtime = controller?.getCurrentRuntime?.();
  const root = trigger.parentElement;
  const ownerOf = (node: HTMLElement): string | null => {
    const owners = new Set<string>();
    const attribute = node.getAttribute('data-demo-owner');
    if (attribute) owners.add(attribute);
    for (const token of node.classList)
      if (token.startsWith('pui-owner-')) owners.add(token.slice('pui-owner-'.length));
    return owners.size === 1 ? [...owners][0] || null : null;
  };
  const owner = ownerOf(trigger);
  if (
    !previewer ||
    previewer.dataset.demoId !== demoId ||
    !controller ||
    !runtime ||
    !owner ||
    !root ||
    !controls ||
    !Number.isSafeInteger(itemCount) ||
    itemCount < 1
  )
    throw new Error('Expected an owned public Select and its committed preview controller');
  const owns = (node: HTMLElement) =>
    node.isConnected && node.ownerDocument === doc && ownerOf(node) === owner;
  const binding: SizingPublicOwnerBinding = Object.freeze({
    owner,
    runtime,
    itemCount: itemCount,
    owns,
    isCurrent: () =>
      trigger.__puiSizingOwner === binding &&
      previewer.isConnected &&
      previewer.dataset.demoId === demoId &&
      previewer.__previewer__ === controller &&
      controller.getCurrentRuntime?.() === runtime &&
      previewer.contains(trigger) &&
      trigger.getAttribute('aria-controls') === controls &&
      trigger.parentElement === root &&
      root.hasAttribute('data-pui-root') &&
      root.getAttribute('data-collection-count') === String(itemCount) &&
      trigger.getAttribute('role') === 'combobox' &&
      owns(trigger) &&
      owns(root),
    read: () => {
      if (!binding.isCurrent()) throw new Error('Public Select owner or committed runtime changed');
      const id = controls;
      const content = id ? doc.getElementById(id) : null;
      if (
        !id ||
        !content ||
        doc.querySelectorAll(`#${doc.defaultView!.CSS.escape(id)}`).length !== 1 ||
        !content.hasAttribute('data-pui-root') ||
        content.getAttribute('role') !== 'listbox' ||
        !owns(content)
      )
        throw new Error('Expected the unique same-owner controlled listbox');
      const childRoot = (parent: HTMLElement, part: string): HTMLElement => {
        const children = [...parent.children].filter((node) => node.hasAttribute('data-pui-root'));
        if (children.length !== 1 || !owns(children[0] as HTMLElement))
          throw new Error(`Expected one same-owner public Select ${part}`);
        return children[0] as HTMLElement;
      };
      // The authored public recipe is Content > Surface > Viewport. Decorative
      // spans are not prototype roots and cannot stand in for either measured box.
      const surface = childRoot(content, 'Surface');
      const viewport = childRoot(surface, 'Viewport');
      const group = childRoot(viewport, 'Group');
      if (group.getAttribute('role') !== 'group')
        throw new Error('Expected the authored public Select Group inside Viewport');
      const items = [...content.querySelectorAll<HTMLElement>('[role="option"]')];
      if (
        items.length !== itemCount ||
        items.some(
          (item, index) =>
            !owns(item) ||
            !group.contains(item) ||
            item.getAttribute('data-collection-index') !== String(index)
        )
      )
        throw new Error('Expected every current same-owner registered option inside Viewport');
      return { content, surface, viewport, items };
    },
  });
  trigger.__puiSizingOwner = binding;
  if (!binding.isCurrent()) throw new Error('Public Select registration is not current');
  return { owner, runtime, itemCount: itemCount };
}

// All runtime dependencies are inside this function: Playwright serializes it into the page.
export function installSizingMotionTrace(
  trigger: SizingMotionTrigger,
  input: SizingMotionSelection | { selection: SizingMotionSelection; itemCount: number }
): SizingMotionHandle {
  trigger.__puiSizingMotion?.stop();
  const selection = typeof input === 'string' ? input : input.selection;
  const itemCount = typeof input === 'string' ? 4 : input.itemCount;
  const doc = trigger.ownerDocument;
  const win = doc.defaultView!;
  const publicOwner = trigger.__puiSizingOwner;
  const owner = publicOwner?.owner ?? trigger.dataset.projectionOwner;
  const runtime = publicOwner?.runtime ?? trigger.dataset.projectionRuntime;
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
      selection,
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
        (publicOwner
          ? !publicOwner.isCurrent() || publicOwner.itemCount !== itemCount
          : trigger.dataset.projectionOwner !== owner ||
            trigger.dataset.projectionRuntime !== runtime)
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
      let publicNodes: ReturnType<SizingPublicOwnerBinding['read']> | null = null;
      if (publicOwner) {
        try {
          publicNodes = publicOwner.read();
        } catch (error) {
          return stop('invalid-owner', String(error));
        }
      }
      if (publicNodes && publicNodes.content !== content)
        return stop('invalid-owner', 'Controlled Content changed during sampling');
      const surface = publicNodes?.surface ?? one('shadcn-select-surface');
      const viewport = publicNodes?.viewport ?? one('shadcn-select-viewport');
      const items = publicNodes?.items ?? [
        ...content.querySelectorAll<HTMLElement>('[role="option"]'),
      ];
      const nodes = [content, surface, viewport, ...items];
      if (
        items.length !== itemCount ||
        nodes.some(
          (node) =>
            !node.isConnected ||
            (publicOwner ? !publicOwner.owns(node) : node.dataset.projectionOwner !== owner)
        ) ||
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
        const target =
          element.dataset.projectionPrototype ??
          (publicOwner
            ? (['Trigger', 'Content', 'Surface', 'Viewport'][index] ?? `Item:${index - 4}`)
            : `node:${index}`);
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
      const selectedIndices: number[] = [];
      const disabledIndices: number[] = [];
      for (const [index, item] of items.entries()) {
        if (item.getAttribute('aria-selected') === 'true') selectedIndices.push(index);
        if (item.getAttribute('aria-disabled') === 'true') disabledIndices.push(index);
      }
      // P-BASE-SELECT-CONTENT-INITIAL-ALIGNMENT-INTENT permits an unset value
      // to align the first enabled row. Navigation must leave selection unset.
      // The caller declares that initial state; a missing selected row in a
      // committed-value phase must never acquire this fallback.
      const alignedIndex =
        selection === 'unset'
          ? items.findIndex((_, index) => !disabledIndices.includes(index))
          : selectedIndices.length === 1
            ? selectedIndices[0]
            : -1;
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
        alignedIndex,
        selectedIndices,
        disabledIndices,
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

/** Size-only oracle for every collected same-owner row, including disabled rows.
 * Position remains the alignment row's separate contract. No filtering by selection. */
export function sizingItemSizeIssues(
  trigger: { width: number; height: number },
  items: ReadonlyArray<{ width: number; height: number }>
): string[] {
  const issues: string[] = [];
  for (const [index, item] of items.entries()) {
    for (const axis of ['width', 'height'] as const) {
      if (
        !Number.isFinite(trigger[axis]) ||
        !Number.isFinite(item[axis]) ||
        Math.abs(item[axis] - trigger[axis]) > 0.5
      )
        issues.push(`item ${index} ${axis} does not match Trigger`);
    }
  }
  return issues;
}

/** Independent checks on the retained whole trajectory, not a selected successful frame. */
export function sizingMotionIssues(
  result: SizingMotionResult,
  runtime: string,
  itemCount = 4
): string[] {
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
      sample.items.length !== itemCount
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
    if (
      sample.selectedIndices.length !== (result.selection === 'unset' ? 0 : 1) ||
      sample.alignedIndex !== result.samples[0].alignedIndex ||
      sample.disabledIndices.includes(sample.alignedIndex) ||
      (result.selection === 'unset' &&
        sample.alignedIndex !==
          sample.items.findIndex((_, index) => !sample.disabledIndices.includes(index))) ||
      (result.selection === 'selected' && sample.selectedIndices[0] !== sample.alignedIndex)
    )
      issues.push('selection/alignment mismatch during motion');
    // In-place certifies the semantic alignment row, including the initial
    // first-enabled candidate, while preserving the committed selection census.
    const aligned = sample.items[sample.alignedIndex];
    if (
      !aligned ||
      !near(aligned.layoutWidth, sample.trigger.layoutWidth) ||
      !near(aligned.layoutHeight, sample.trigger.layoutHeight)
    )
      issues.push('layout mismatch during motion');
    // Layout boxes are scale-independent. Retain the separate per-row paint
    // equation below rather than comparing animated painted boxes to Trigger.
    issues.push(
      ...sizingItemSizeIssues(
        { width: sample.trigger.layoutWidth, height: sample.trigger.layoutHeight },
        sample.items.map((item) => ({ width: item.layoutWidth, height: item.layoutHeight }))
      )
    );
    if (
      !near(sample.content.layoutWidth, sample.surface.layoutWidth) ||
      sample.surface.layoutWidth < sample.trigger.layoutWidth - 0.5
    )
      issues.push('popup cannot contain the matched row');
    for (const item of sample.items) {
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
