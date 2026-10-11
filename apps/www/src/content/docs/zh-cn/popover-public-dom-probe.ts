import type { Locator, Page } from 'playwright-core';

export interface PopoverDomTimeline {
  schemaVersion: 'popover-public-dom-timeline-v1';
  timeOrigin: number;
  samples: Array<Record<string, unknown>>;
  droppedSamples: number;
  observerErrors: string[];
  stopped: boolean;
  limit: string;
}
export interface PopoverDomProbe {
  mark(phase: string): Promise<void>;
  finish(): Promise<PopoverDomTimeline | { observerErrors: string[] }>;
}

/** Self-contained for Playwright serialization; exported only for DOM unit tests.
 * Observations can perturb timing. No runtime internals, input, style writes, or waits.
 * No URLs, element IDs, text, HTML, input values, or raw style/error strings are saved.
 */
export function installPopoverDomProbe(trigger: Element, options: { maxSamples?: number } = {}) {
  const doc = trigger.ownerDocument;
  const win = doc.defaultView!;
  const requestedMax = options.maxSamples ?? 256;
  const max = Number.isFinite(requestedMax)
    ? Math.max(8, Math.min(512, Math.floor(requestedMax)))
    : 256;
  const firstLimit = Math.floor(max / 2);
  const first: Array<Record<string, unknown>> = [];
  const tail: Array<Record<string, unknown>> = [];
  const errors: string[] = [];
  let dropped = 0,
    seq = 0,
    stopped = false,
    raf = 0,
    phase = 'installed';
  let panel: Element | null = null,
    close: Element | null = null;
  const ids = new WeakMap<Node, number>();
  let nextId = 0;
  const roots = new Set<Document | ShadowRoot>();
  const observed = new Set<Element>();
  const removers: Array<() => void> = [];
  const seenEvents = new WeakSet<Event>();
  const safeError = (code: string) => {
    if (errors.length < 16) errors.push(code);
  };
  const key = (node: Node | null) => {
    if (!node) return null;
    if (!ids.has(node)) ids.set(node, ++nextId);
    return ids.get(node)!;
  };
  const parent = (node: Node): Node | null =>
    (node instanceof win.Element ? node.assignedSlot : null) ??
    node.parentNode ??
    (node instanceof win.ShadowRoot ? node.host : null);
  const ref = (node: Node | null): Record<string, unknown> | null =>
    node
      ? {
          key: key(node),
          tag:
            node instanceof win.Element
              ? node.tagName.toLowerCase()
              : node instanceof win.ShadowRoot
                ? '#shadow-root'
                : '#document',
          connected: node.isConnected,
          parent: key(parent(node)),
        }
      : null;
  const rect = (element: Element) => {
    const r = element.getBoundingClientRect();
    return {
      x: r.x,
      y: r.y,
      top: r.top,
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      width: r.width,
      height: r.height,
    };
  };
  const scroll = (element: Element) => ({
    top: element.scrollTop,
    left: element.scrollLeft,
    width: element.scrollWidth,
    height: element.scrollHeight,
    clientWidth: element.clientWidth,
    clientHeight: element.clientHeight,
  });
  const css = (element: Element) => {
    const c = win.getComputedStyle(element);
    return {
      display: c.display,
      visibility: c.visibility,
      position: c.position,
      top: c.top,
      right: c.right,
      bottom: c.bottom,
      left: c.left,
      transform: c.transform,
      translate: c.translate,
      boxSizing: c.boxSizing,
      width: c.width,
      height: c.height,
      minHeight: c.minHeight,
      maxHeight: c.maxHeight,
      overflowX: c.overflowX,
      overflowY: c.overflowY,
      fontSize: c.fontSize,
      lineHeight: c.lineHeight,
      // Presence only: filter/will-change and custom-property strings could contain URLs.
      hasFilter: c.filter !== '' && c.filter !== 'none',
      hasPerspective: c.perspective !== '' && c.perspective !== 'none',
      hasContain: c.contain !== '' && c.contain !== 'none',
      hasWillChange: c.willChange !== '' && c.willChange !== 'auto',
    };
  };
  const available = (element: Element, property: string) => {
    const value = win.getComputedStyle(element).getPropertyValue(property).trim();
    return /^-?\d+(?:\.\d+)?px$/.test(value) ? Number.parseFloat(value) : null;
  };
  const geometry = (element: Element | null): Record<string, unknown> | null => {
    if (!element) return null;
    const r = rect(element);
    const side = element.getAttribute('data-side');
    const align = element.getAttribute('data-align');
    return {
      node: ref(element),
      rootHost: ref(
        element.getRootNode() instanceof win.ShadowRoot
          ? (element.getRootNode() as ShadowRoot).host
          : null
      ),
      offsetParent: ref((element as HTMLElement).offsetParent),
      availableSpace: {
        width: available(element, '--proto-ui-available-width'),
        height: available(element, '--proto-ui-available-height'),
      },
      rect: r,
      scroll: scroll(element),
      computed: css(element),
      attributes: {
        expanded: element.getAttribute('aria-expanded') === 'true',
        hidden: element.hasAttribute('hidden'),
        focused: element.hasAttribute('data-focused'),
        side: ['top', 'right', 'bottom', 'left'].includes(side ?? '') ? side : null,
        align: ['start', 'center', 'end'].includes(align ?? '') ? align : null,
      },
      viewportIntersection: {
        width: Math.max(0, Math.min(r.right, win.innerWidth) - Math.max(r.left, 0)),
        height: Math.max(0, Math.min(r.bottom, win.innerHeight) - Math.max(r.top, 0)),
      },
      shadowSurfaces: element.shadowRoot
        ? Array.from(element.shadowRoot.querySelectorAll('button,[role="button"]'))
            .slice(0, 8)
            .map((surface) => ({ node: ref(surface), rect: rect(surface), computed: css(surface) }))
        : [],
    };
  };
  const snapshot = () => {
    const chain: Array<Record<string, unknown> | null> = [];
    let active: Element | null = doc.activeElement;
    while (active && chain.length < 12) {
      chain.push(ref(active));
      active = active.shadowRoot?.activeElement ?? null;
    }
    const ancestors = new Set<Element>();
    for (const target of [trigger, panel, close]) {
      let ancestor: Node | null = target ? parent(target) : null;
      for (let n = 0; ancestor && n < 16; n++, ancestor = parent(ancestor))
        if (ancestor instanceof win.Element) ancestors.add(ancestor);
    }
    const visual = win.visualViewport;
    return {
      document: {
        scrollX: win.scrollX,
        scrollY: win.scrollY,
        hasFocus: doc.hasFocus(),
        scrollingElement: doc.scrollingElement
          ? { node: ref(doc.scrollingElement), ...scroll(doc.scrollingElement) }
          : null,
        rootFont: win.getComputedStyle(doc.documentElement).fontSize,
        rootRect: rect(doc.documentElement),
        bodyRect: doc.body ? rect(doc.body) : null,
      },
      viewport: {
        width: win.innerWidth,
        height: win.innerHeight,
        dpr: win.devicePixelRatio,
        visual: visual
          ? {
              width: visual.width,
              height: visual.height,
              offsetTop: visual.offsetTop,
              offsetLeft: visual.offsetLeft,
              pageTop: visual.pageTop,
              pageLeft: visual.pageLeft,
              scale: visual.scale,
            }
          : null,
      },
      activeChain: chain,
      missingTargets: {
        panel: panel ? null : 'not-found-open-shadow-only',
        close: close ? null : 'not-found-open-shadow-only',
      },
      elements: { trigger: geometry(trigger), panel: geometry(panel), close: geometry(close) },
      ancestors: Array.from(ancestors).map((element) => ({
        node: ref(element),
        rect: rect(element),
        scroll: scroll(element),
        computed: css(element),
      })),
      ancestorDepthLimit: 16,
    };
  };
  const record = (reason: string, detail: Record<string, unknown> = {}) => {
    if (stopped) return;
    try {
      const start = win.performance.now();
      const sample = {
        seq: ++seq,
        phase,
        reason,
        at: start,
        detail,
        snapshot: snapshot(),
        snapshotEnd: win.performance.now(),
      };
      if (first.length < firstLimit) first.push(sample);
      else {
        tail.push(sample);
        if (first.length + tail.length > max) {
          tail.shift();
          dropped++;
        }
      }
    } catch {
      safeError('snapshot-failed');
    }
  };
  const nextFrame = () => {
    if (stopped || raf) return;
    raf = win.requestAnimationFrame(() => {
      raf = 0;
      record('next-animation-frame');
    });
  };
  const event = (e: Event) => {
    if (seenEvents.has(e)) return;
    seenEvents.add(e);
    // A portal may appear and focus synchronously before MutationObserver delivery.
    try {
      discover();
    } catch {
      safeError('event-discovery-failed');
    }
    record(e.type, {
      target: ref(e.target instanceof win.Node ? e.target : null),
      eventTimeStamp: e.timeStamp,
      composedPath: e
        .composedPath()
        .slice(0, 12)
        .filter((node): node is Node => node instanceof win.Node)
        .map(ref),
      targetKind:
        e.target === win.visualViewport
          ? 'visual-viewport'
          : e.target === win
            ? 'window'
            : e.target === doc
              ? 'document'
              : 'element',
      relatedTarget: ref(
        e instanceof win.FocusEvent && e.relatedTarget instanceof win.Node ? e.relatedTarget : null
      ),
    });
    nextFrame();
  };
  const listen = (target: EventTarget, type: string) => {
    target.addEventListener(type, event, { capture: true, passive: true });
    removers.push(() => target.removeEventListener(type, event, true));
  };
  const resizeObserver =
    typeof win.ResizeObserver === 'function'
      ? new win.ResizeObserver((entries) => {
          record('resize-observer', { targets: entries.map((entry) => ref(entry.target)) });
          nextFrame();
        })
      : null;
  const discover = () => {
    const visit = (root: Document | ShadowRoot) => {
      if (!roots.has(root)) {
        roots.add(root);
        for (const name of ['focusin', 'focusout', 'scroll', 'pointerdown', 'pointerup', 'click'])
          listen(root, name);
        mutationObserver?.observe(root, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: [
            'style',
            'class',
            'hidden',
            'aria-expanded',
            'aria-controls',
            'data-side',
            'data-align',
            'data-state',
          ],
        });
      }
      for (const element of root.querySelectorAll('*'))
        if (element.shadowRoot) visit(element.shadowRoot);
    };
    visit(doc);
    const controlId = trigger.getAttribute('aria-controls');
    panel = null;
    for (const root of roots)
      for (const element of root.querySelectorAll('[role="dialog"]'))
        if (controlId && element.id === controlId && element.isConnected) panel = element;
    close = null;
    if (panel) {
      const find = (root: Element | ShadowRoot) => {
        for (const element of root.querySelectorAll('*')) {
          // Selector input is the existing public demo label; its text is never saved.
          if (element.getAttribute('role') === 'button' && element.textContent?.trim() === 'Close')
            close ??= element;
          if (element.shadowRoot) find(element.shadowRoot);
        }
      };
      find(panel);
      if ((panel as Element).shadowRoot) find((panel as Element).shadowRoot!);
    }
    const targets = new Set(
      [doc.documentElement, doc.body, trigger, panel, close].filter((target): target is Element =>
        Boolean(target)
      )
    );
    for (const previous of observed)
      if (!targets.has(previous)) {
        resizeObserver?.unobserve(previous);
        observed.delete(previous);
      }
    for (const target of targets)
      if (!observed.has(target)) {
        observed.add(target);
        resizeObserver?.observe(target);
      }
  };
  const mutationObserver =
    typeof win.MutationObserver === 'function'
      ? new win.MutationObserver((records) => {
          try {
            const oldPanel = panel,
              oldClose = close;
            const structural = records.some(
              (r) => r.type === 'childList' || r.attributeName === 'aria-controls'
            );
            if (structural) discover();
            const relevant = records.filter(
              (r) =>
                r.target === trigger ||
                r.target === panel ||
                r.target === close ||
                r.target === doc.documentElement
            );
            if (oldPanel !== panel || oldClose !== close || relevant.length) {
              record('dom-mutation', {
                targetChanges: oldPanel !== panel || oldClose !== close,
                attributes: relevant
                  .slice(0, 16)
                  .map((r) => ({ node: ref(r.target), attribute: r.attributeName, type: r.type })),
              });
              nextFrame();
            }
          } catch {
            safeError('mutation-observer-failed');
          }
        })
      : null;
  const cleanup = () => {
    stopped = true;
    if (raf) {
      win.cancelAnimationFrame(raf);
      raf = 0;
    }
    try {
      mutationObserver?.disconnect();
    } catch {
      safeError('mutation-disconnect-failed');
    }
    try {
      resizeObserver?.disconnect();
    } catch {
      safeError('resize-disconnect-failed');
    }
    for (const remove of removers) {
      try {
        remove();
      } catch {
        safeError('listener-cleanup-failed');
      }
    }
    roots.clear();
    observed.clear();
  };
  try {
    discover();
    listen(win, 'resize');
    if (win.visualViewport) {
      listen(win.visualViewport, 'resize');
      listen(win.visualViewport, 'scroll');
    }
    record('installed');
  } catch {
    safeError('installation-failed');
    cleanup();
  }
  return {
    mark(value: string) {
      if (stopped) return;
      phase = value.replace(/[^a-zA-Z0-9._:-]/g, '_').slice(0, 80);
      try {
        discover();
        record('marker');
      } catch {
        safeError('marker-failed');
      }
    },
    stop(): PopoverDomTimeline {
      record('finished');
      cleanup();
      return {
        schemaVersion: 'popover-public-dom-timeline-v1',
        timeOrigin: win.performance.timeOrigin,
        samples: [...first, ...tail],
        droppedSamples: dropped,
        observerErrors: [...errors],
        stopped,
        limit:
          'Public DOM observations only; reads may perturb timing. Root text scaling is not browser zoom. Geometry is not hit-area acceptance.',
      };
    },
  };
}

/** All diagnostic failures are data, never a replacement for the journey's error. */
export async function startPopoverDomProbe(
  _page: Page,
  trigger: Locator
): Promise<PopoverDomProbe> {
  const observerErrors: string[] = [];
  const handle = await trigger
    .evaluateHandle(installPopoverDomProbe, { maxSamples: 256 })
    .catch(() => {
      observerErrors.push('probe-installation-failed');
      return null;
    });
  return {
    async mark(phase) {
      if (!handle) return;
      try {
        await handle.evaluate((probe, value) => probe.mark(value), phase);
      } catch {
        if (observerErrors.length < 16) observerErrors.push('probe-marker-failed');
      }
    },
    async finish() {
      try {
        if (!handle) return { observerErrors };
        const timeline = await handle.evaluate((probe) => probe.stop());
        timeline.observerErrors.push(...observerErrors);
        return timeline;
      } catch {
        return { observerErrors: [...observerErrors, 'probe-finalization-failed'] };
      } finally {
        await handle?.dispose().catch(() => undefined);
      }
    },
  };
}
