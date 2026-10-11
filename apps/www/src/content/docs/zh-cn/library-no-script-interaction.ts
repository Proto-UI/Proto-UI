import type { Locator, Page } from 'playwright-core';

export interface NoScriptLinkSample {
  connected: boolean;
  visible: boolean;
  href: string;
  target: string;
  download: boolean;
  rect: { x: number; y: number; width: number; height: number };
  viewport: { width: number; height: number; scrollX: number; scrollY: number };
  point: { x: number; y: number };
  receivesEvents: boolean;
  wheelPoint: { x: number; y: number } | null;
  visibleBounds: { left: number; top: number; right: number; bottom: number } | null;
  wheelRoute?: unknown;
  wheelContext?: unknown;
}

/** Read-only geometry and native hit testing. It never invokes page rAF or
 * mutates scrolling, styles, focus, event handlers or the no-script setting. */
export function readNoScriptLink(element: Element, diagnostics = false): NoScriptLinkSample {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const point = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const hit = document.elementFromPoint(point.x, point.y);
  let wheelPoint: { x: number; y: number } | null = null;
  let wheelRoute: unknown;
  let visibleBounds: NoScriptLinkSample['visibleBounds'] = null;
  // The native wheel must reach the same scroll owner as the destination.
  // A fixed viewport coordinate can instead scroll an unrelated no-JS sidebar
  // whose overscroll containment correctly prevents document scroll chaining.
  try {
    const styles = new Map<Element, CSSStyleDeclaration>();
    const css = (node: Element) => {
      let value = styles.get(node);
      if (!value) {
        value = getComputedStyle(node);
        styles.set(node, value);
      }
      return value;
    };
    const chain = (start: Element | null) => {
      const nodes: Element[] = [];
      for (let node = start; node; ) {
        if (nodes.length >= 128) return null;
        nodes.push(node);
        const root = node.getRootNode();
        node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
      }
      return nodes;
    };
    const isScrollBoundary = (node: Element) => {
      if (node === document.scrollingElement) return true;
      const style = css(node);
      return (
        /^(auto|scroll|overlay|hidden)$/.test(style.overflowY) &&
        (node.scrollHeight > node.clientHeight ||
          /^(contain|none)$/.test(style.overscrollBehaviorY))
      );
    };
    const targetChain = chain(element);
    if (!targetChain) throw new Error('Target clipping ancestry exceeds 128 elements');
    const bounds = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    for (const node of targetChain.slice(1)) {
      const style = css(node);
      // Rectangular clipping is the supported observation. Do not claim
      // full-link visibility from an axis-aligned box after transforms/masks.
      if (
        (style.transform && style.transform !== 'none') ||
        (style.zoom && !['1', 'normal'].includes(style.zoom)) ||
        (style.clipPath && style.clipPath !== 'none')
      )
        throw new Error('Transformed or masked clipping ancestry is unsupported');
      if (node === document.scrollingElement) continue;
      const clipX = /^(auto|scroll|overlay|hidden|clip)$/.test(style.overflowX);
      const clipY = /^(auto|scroll|overlay|hidden|clip)$/.test(style.overflowY);
      if (!clipX && !clipY) continue;
      const box = node.getBoundingClientRect();
      if (clipX) {
        bounds.left = Math.max(bounds.left, box.left + node.clientLeft);
        bounds.right = Math.min(bounds.right, box.left + node.clientLeft + node.clientWidth);
      }
      if (clipY) {
        bounds.top = Math.max(bounds.top, box.top + node.clientTop);
        bounds.bottom = Math.min(bounds.bottom, box.top + node.clientTop + node.clientHeight);
      }
    }
    if (!Object.values(bounds).every(Number.isFinite)) throw new Error('Invalid clipping geometry');
    visibleBounds = bounds;
    const fullyWithin =
      rect.x >= bounds.left &&
      rect.y >= bounds.top &&
      rect.x + rect.width <= bounds.right &&
      rect.y + rect.height <= bounds.bottom;
    const owner = targetChain.find(isScrollBoundary);
    const candidates: { point: { x: number; y: number }; reason: string }[] = [];
    if (
      !fullyWithin &&
      owner &&
      (owner === document.scrollingElement || css(owner).overflowY !== 'hidden')
    ) {
      if (bounds.right > bounds.left && bounds.bottom > bounds.top) {
        outer: for (const fy of [0.75, 0.5, 0.9])
          for (const fx of [0.5, 0.05, 0.95, 0.25, 0.75]) {
            const point = {
              x: bounds.left + (bounds.right - bounds.left) * fx,
              y: bounds.top + (bounds.bottom - bounds.top) * fy,
            };
            const hitChain = chain(document.elementFromPoint(point.x, point.y));
            const hitOwner = hitChain?.find(isScrollBoundary);
            const overlay = hitChain?.some(
              (node) => /^(fixed|sticky)$/.test(css(node).position) && !targetChain!.includes(node)
            );
            const reason = !hitChain
              ? 'ancestry-limit'
              : overlay
                ? 'unrelated-overlay'
                : hitOwner !== owner
                  ? 'different-scroll-owner'
                  : 'same-scroll-owner';
            candidates.push({ point, reason });
            if (reason === 'same-scroll-owner') {
              wheelPoint = point;
              break outer;
            }
          }
      }
    }
    wheelRoute = {
      owner: owner
        ? { tag: owner.tagName, id: owner.id, className: owner.getAttribute('class') }
        : null,
      candidates,
      bounded: 'at most 15 native hit tests; each ancestry at most 128 elements',
    };
  } catch (error) {
    // Missing native routing evidence is fail-closed, never a guessed point.
    visibleBounds = null;
    wheelRoute = { unavailable: String(error) };
  }
  let wheelContext: unknown;
  if (diagnostics) {
    try {
      const inspect = (node: Element | null) => {
        if (!node) return null;
        const box = node.getBoundingClientRect(),
          css = getComputedStyle(node);
        return {
          tag: node.tagName,
          id: node.id,
          className: node.getAttribute('class'),
          rect: { x: box.x, y: box.y, width: box.width, height: box.height },
          scrollTop: node.scrollTop,
          scrollLeft: node.scrollLeft,
          scrollHeight: node.scrollHeight,
          scrollWidth: node.scrollWidth,
          clientHeight: node.clientHeight,
          clientWidth: node.clientWidth,
          overflowX: css.overflowX,
          overflowY: css.overflowY,
          overscrollBehaviorX: css.overscrollBehaviorX,
          overscrollBehaviorY: css.overscrollBehaviorY,
          scrollBehavior: css.scrollBehavior,
          position: css.position,
          pointerEvents: css.pointerEvents,
          touchAction: css.touchAction,
          fontSize: css.fontSize,
          zoom: css.zoom,
          transform: css.transform,
        };
      };
      const inspectedPoint = wheelPoint ?? { x: innerWidth / 2, y: innerHeight * 0.75 };
      let node = document.elementFromPoint(inspectedPoint.x, inspectedPoint.y);
      const hitChain = [];
      for (let depth = 0; node && depth < 32; depth++) {
        hitChain.push(inspect(node));
        const root = node.getRootNode();
        node = node.parentElement ?? (root instanceof ShadowRoot ? root.host : null);
      }
      wheelContext = {
        wheelPoint: inspectedPoint,
        hitChain,
        chainTruncated: node !== null,
        scrollingElement: inspect(document.scrollingElement),
        root: inspect(document.documentElement),
        body: inspect(document.body),
        visualViewport: visualViewport && {
          width: visualViewport.width,
          height: visualViewport.height,
          scale: visualViewport.scale,
          offsetLeft: visualViewport.offsetLeft,
          offsetTop: visualViewport.offsetTop,
          pageLeft: visualViewport.pageLeft,
          pageTop: visualViewport.pageTop,
        },
        devicePixelRatio,
        rootFontSize: getComputedStyle(document.documentElement).fontSize,
      };
    } catch (error) {
      // Read-only diagnostic failure must not replace the interaction verdict.
      wheelContext = { unavailable: String(error) };
    }
  }
  return {
    wheelPoint,
    visibleBounds,
    ...(diagnostics ? { wheelContext, wheelRoute } : {}),
    connected: element.isConnected,
    visible:
      style.display !== 'none' && style.visibility === 'visible' && Number(style.opacity) > 0,
    href: element instanceof HTMLAnchorElement ? element.href : '',
    target: element.getAttribute('target') ?? '',
    download: element.hasAttribute('download'),
    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    viewport: { width: innerWidth, height: innerHeight, scrollX, scrollY },
    point,
    receivesEvents: !!hit && (hit === element || element.contains(hit)),
  };
}

export interface NoScriptInput {
  sample(): Promise<NoScriptLinkSample>;
  move(x: number, y: number): Promise<void>;
  wheel(deltaY: number): Promise<void>;
  down(): Promise<void>;
  up(): Promise<void>;
}

export interface NoScriptInputTrace {
  entries: {
    operation: keyof NoScriptInput;
    args: number[];
    startedAt: number;
    settledAt?: number;
    status: 'pending' | 'fulfilled' | 'rejected';
    sample?: NoScriptLinkSample;
    error?: string;
  }[];
  dropped: number;
}

/** Protocol completion is not evidence of DOM event delivery or scrolling.
 * Subsequent sample geometry records actual observed movement separately. */
export function traceNoScriptInput(input: NoScriptInput, trace: NoScriptInputTrace): NoScriptInput {
  const record = async <T>(
    operation: keyof NoScriptInput,
    args: number[],
    work: () => Promise<T>
  ) => {
    const entry: NoScriptInputTrace['entries'][number] = {
      operation,
      args,
      startedAt: performance.now(),
      status: 'pending',
    };
    if (trace.entries.length < 2048) trace.entries.push(entry);
    else trace.dropped++;
    try {
      const result = await work();
      entry.status = 'fulfilled';
      if (operation === 'sample') entry.sample = result as NoScriptLinkSample;
      return result;
    } catch (error) {
      entry.status = 'rejected';
      try {
        entry.error = String(error);
      } catch {
        entry.error = 'Unprintable rejection';
      }
      throw error;
    } finally {
      entry.settledAt = performance.now();
    }
  };
  return {
    sample: () => record('sample', [], input.sample),
    move: (x, y) => record('move', [x, y], () => input.move(x, y)),
    wheel: (delta) => record('wheel', [delta], () => input.wheel(delta)),
    down: () => record('down', [], input.down),
    up: () => record('up', [], input.up),
  };
}

export function noScriptInput(
  page: Page,
  link: Locator,
  trace?: NoScriptInputTrace
): NoScriptInput {
  const input: NoScriptInput = {
    sample: () => link.evaluate(readNoScriptLink, !!trace),
    move: (x, y) => page.mouse.move(x, y),
    wheel: (deltaY) => page.mouse.wheel(0, deltaY),
    down: () => page.mouse.down(),
    up: () => page.mouse.up(),
  };
  return trace ? traceNoScriptInput(input, trace) : input;
}

const hostSleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(() => resolve(), milliseconds));
const stableKey = (s: NoScriptLinkSample) =>
  JSON.stringify([
    s.rect,
    s.viewport,
    s.visibleBounds,
    s.point,
    s.href,
    s.visible,
    s.connected,
    s.receivesEvents,
    s.target,
    s.download,
  ]);

export function assertNoScriptDestination(sample: NoScriptLinkSample, expected: string) {
  const destination = new URL(expected);
  if (
    !['http:', 'https:'].includes(destination.protocol) ||
    sample.href !== destination.href ||
    (sample.target && sample.target !== '_self') ||
    sample.download
  )
    throw new Error('No-script link does not name the expected same-context destination');
  const values = [
    ...Object.values(sample.rect),
    ...Object.values(sample.viewport),
    ...Object.values(sample.point),
    ...Object.values(sample.visibleBounds ?? {}),
  ];
  if (
    !values.every(Number.isFinite) ||
    sample.rect.width <= 0 ||
    sample.rect.height <= 0 ||
    sample.viewport.width <= 0 ||
    sample.viewport.height <= 0 ||
    !sample.connected ||
    !sample.visible
  )
    throw new Error('No-script link is detached, hidden or has invalid geometry');
  if (!sample.visibleBounds)
    throw new Error('No-script link visible clipping bounds are unavailable');
}

export function linkWithinViewport(sample: NoScriptLinkSample) {
  const { rect, viewport, visibleBounds } = sample;
  // Require the actual action link, not the taller containing Card, to fit.
  return (
    !!visibleBounds &&
    rect.x >= Math.max(0, visibleBounds.left) &&
    rect.y >= Math.max(0, visibleBounds.top) &&
    rect.x + rect.width <= viewport.width &&
    rect.y + rect.height <= viewport.height &&
    rect.x + rect.width <= visibleBounds.right &&
    rect.y + rect.height <= visibleBounds.bottom
  );
}

/** Host-clock samples are explicitly not page animation frames. They establish
 * bounded observed geometry stability when no-script Chromium provides no rAF.
 * mouse.wheel is real input and does not promise scrolling has completed. */
export async function revealNoScriptLink(
  input: NoScriptInput,
  expected: string,
  options: {
    timeoutMs?: number;
    maxWheels?: number;
    now?: () => number;
    sleep?: typeof hostSleep;
  } = {}
) {
  const timeout = options.timeoutMs ?? 30_000;
  const maxWheels = options.maxWheels ?? 40;
  const now = options.now ?? (() => performance.now());
  const sleep = options.sleep ?? hostSleep;
  const started = now();
  const samples: NoScriptLinkSample[] = [];
  let wheels = 0,
    previous = '',
    stable = 0;
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    const remaining = timeout - (now() - started);
    if (remaining <= 0) throw new Error('No-script interaction exceeded its deadline');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('No-script interaction exceeded its deadline')),
            remaining
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  while (true) {
    const sample = await bounded(input.sample);
    assertNoScriptDestination(sample, expected);
    samples.push(sample);
    const key = stableKey(sample);
    stable = key === previous ? stable + 1 : 1;
    previous = key;
    if (stable >= 3) {
      if (linkWithinViewport(sample)) {
        if (!sample.receivesEvents)
          throw new Error('No-script link is obstructed at its native hit point');
        return {
          sample,
          samples,
          wheels,
          elapsedMs: now() - started,
          stability: 'three host-clock samples, at least 50ms apart; not rAF frames',
        };
      }
      const bounds = sample.visibleBounds!;
      if (
        sample.rect.width > bounds.right - bounds.left ||
        sample.rect.height > bounds.bottom - bounds.top
      )
        throw new Error('No-script action link cannot fit in its visible scrollport');
      if (wheels >= maxWheels)
        throw new Error('No-script link remained unreachable after bounded wheel input');
      const delta = Math.max(
        -sample.viewport.height * 0.8,
        Math.min(sample.viewport.height * 0.8, sample.point.y - (bounds.top + bounds.bottom) / 2)
      );
      if (Math.abs(delta) < 1)
        throw new Error('No-script link is horizontally outside the viewport');
      const wheelPoint = sample.wheelPoint;
      if (
        !wheelPoint ||
        !Number.isFinite(wheelPoint.x) ||
        !Number.isFinite(wheelPoint.y) ||
        wheelPoint.x <= 0 ||
        wheelPoint.y <= 0 ||
        wheelPoint.x >= sample.viewport.width ||
        wheelPoint.y >= sample.viewport.height
      )
        throw new Error(
          'No-script destination has no unobstructed wheel surface for its scroll owner'
        );
      await bounded(() => input.move(wheelPoint.x, wheelPoint.y));
      const positioned = await bounded(input.sample);
      assertNoScriptDestination(positioned, expected);
      if (
        stableKey(positioned) !== stableKey(sample) ||
        positioned.wheelPoint?.x !== wheelPoint.x ||
        positioned.wheelPoint?.y !== wheelPoint.y
      )
        throw new Error('No-script wheel route changed after pointer positioning');
      await bounded(() => input.wheel(delta));
      wheels++;
      stable = 0;
      previous = '';
    }
    await bounded(() => sleep(50));
  }
}

/** Recheck after capture and pointer movement. Never force or dispatch a DOM
 * click: mouse down/up must hit the same visible native anchor. */
export async function activateNoScriptLink(
  input: NoScriptInput,
  expected: string,
  options: { timeoutMs?: number; now?: () => number; sleep?: typeof hostSleep } = {}
) {
  const now = options.now ?? (() => performance.now());
  const started = now();
  const timeout = options.timeoutMs ?? 30_000;
  const remaining = () => timeout - (now() - started);
  async function bounded<T>(operation: () => Promise<T>): Promise<T> {
    const milliseconds = remaining();
    if (milliseconds <= 0) throw new Error('No-script activation exceeded its deadline');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        operation(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('No-script activation exceeded its deadline')),
            milliseconds
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  const before = await bounded(() =>
    revealNoScriptLink(input, expected, { ...options, timeoutMs: remaining() })
  );
  await bounded(() => input.move(before.sample.point.x, before.sample.point.y));
  const after = await bounded(() =>
    revealNoScriptLink(input, expected, { ...options, timeoutMs: remaining() })
  );
  if (stableKey(before.sample) !== stableKey(after.sample))
    throw new Error('No-script link moved or changed after pointer positioning');
  let press: Promise<void> | undefined;
  let pressSettled = false;
  async function releaseAfterFailure() {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        input.up(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('Pointer release exceeded 1s')), 1000);
        }),
      ]);
    } catch {
      // Cleanup must not replace the original failure, including falsy values.
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    await bounded(() => {
      // A rejected or timed-out transport can still have sent the press.
      press = Promise.resolve()
        .then(input.down)
        .then(
          () => {
            pressSettled = true;
          },
          (error) => {
            pressSettled = true;
            throw error;
          }
        );
      return press;
    });
    const pressed = await bounded(input.sample);
    assertNoScriptDestination(pressed, expected);
    if (
      !linkWithinViewport(pressed) ||
      !pressed.receivesEvents ||
      stableKey(pressed) !== stableKey(after.sample)
    )
      throw new Error('No-script link changed or became obstructed during native press');
    await bounded(input.up);
  } catch (primary) {
    if (press) {
      // Release now for a potentially delivered press. If transport completes
      // later, release again then; late cleanup performs no new press/scroll.
      if (!pressSettled) void press.then(releaseAfterFailure, releaseAfterFailure);
      await releaseAfterFailure();
    }
    throw primary;
  }
  return { before, after };
}
