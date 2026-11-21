// Private diagnostic helper for the existing official runtimeTabsJourney.
// Import createRuntimeTabsScrollProbe and install with list.evaluateHandle(...)
// BEFORE setViewportSize(320). No focus/scroll/style writes or input synthesis.
export function createRuntimeTabsScrollProbe(list) {
  const doc = list.ownerDocument;
  const view = doc.defaultView;
  const nodes = new Map();
  let nextId = 0;
  const identity = (node) => {
    if (!node) return null;
    if (!nodes.has(node)) nodes.set(node, ++nextId);
    return nodes.get(node);
  };
  const active = () => {
    let node = doc.activeElement;
    while (node?.shadowRoot?.activeElement) node = node.shadowRoot.activeElement;
    return node;
  };
  const frames = [];
  const events = [];
  let raf = 0;
  let stopped = false;
  const installedAt = view.performance.now();
  const describe = (node) => {
    const box = node.getBoundingClientRect();
    const css = view.getComputedStyle(node);
    const range = doc.createRange();
    range.selectNodeContents(node);
    const text = range.getBoundingClientRect();
    return {
      identity: identity(node), tag: node.localName, role: node.getAttribute('role'),
      runtime: node.getAttribute('data-runtime-tab'), connected: node.isConnected,
      selected: node.getAttribute('aria-selected'), tabIndex: node.tabIndex,
      active: active() === node, containsActive: node.contains(active()),
      rect: { x: box.x, right: box.right, width: box.width, y: box.y, height: box.height },
      text: { x: text.x, right: text.right, width: text.width },
      clientWidth: node.clientWidth, clientLeft: node.clientLeft,
      scrollWidth: node.scrollWidth, scrollLeft: node.scrollLeft,
      maxScrollLeft: node.scrollWidth - node.clientWidth,
      overflowX: css.overflowX, overflowY: css.overflowY,
      scrollBehavior: css.scrollBehavior, scrollPadding: css.scrollPadding,
      scrollMargin: css.scrollMargin, direction: css.direction,
      display: css.display, width: css.width, minWidth: css.minWidth,
      flex: css.flex, gap: css.gap, padding: css.padding, border: css.border,
      transform: css.transform, zoom: css.zoom,
      tokens: node.getAttribute('data-pui-style'),
    };
  };
  const sample = (phase) => {
    const ancestors = [];
    for (let node = list; node; node = node.parentElement ?? node.getRootNode()?.host ?? null)
      ancestors.push(describe(node));
    const tabs = [...list.querySelectorAll('[role="tab"]')].map(describe);
    const last = tabs.at(-1);
    const own = ancestors[0];
    const frame = {
      at: view.performance.now(), phase, active: identity(active()),
      viewport: { width: view.innerWidth, height: view.innerHeight,
        visualWidth: view.visualViewport?.width, scale: view.visualViewport?.scale },
      ancestors, tabs,
      // Same border-box acceptance as original journey, including its 1px tolerance.
      originalGeometryPass: !!last && last.rect.x >= own.rect.x - 1 &&
        last.rect.right <= own.rect.right + 1,
      rightExcess: last ? last.rect.right - own.rect.right : null,
    };
    frames.push(frame);
    return frame;
  };
  // Bounded to 120 frames; an exhausted trace is diagnostic, never a passing wait.
  const tick = () => {
    if (stopped || frames.length >= 120) return;
    sample('animation-frame');
    raf = view.requestAnimationFrame(tick);
  };
  const record = (event) => {
    const target = event.composedPath()[0];
    events.push({ at: view.performance.now(), kind: event.type,
      trusted: event.isTrusted, key: event.key ?? null,
      target: identity(target), active: identity(active()) });
  };
  for (const kind of ['keydown', 'focusin', 'focusout', 'scroll'])
    doc.addEventListener(kind, record, true);
  sample('installed-before-resize');
  raf = view.requestAnimationFrame(tick);
  return {
    mark: sample,
    stop() {
      stopped = true;
      view.cancelAnimationFrame(raf);
      for (const kind of ['keydown', 'focusin', 'focusout', 'scroll'])
        doc.removeEventListener(kind, record, true);
      sample('stopped');
      return { timeOrigin: view.performance.timeOrigin, installedAt,
        frames, events, frameLimitReached: frames.length >= 120 };
    },
  };
}
