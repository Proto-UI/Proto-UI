/** Read-only native-browser observations for the retained Contents Popover.
 * This function is serialized by Playwright; keep its closure self-contained. */
export function observeContentsWheel(element: HTMLElement) {
  const document = element.ownerDocument;
  const view = document.defaultView!;
  const surface =
    element.shadowRoot?.querySelector<HTMLElement>('[data-pui-split-surface]') ?? element;
  const identities = new WeakMap<Element, number>();
  let serial = 0;
  let disposed = false;
  const identity = (node: Element) => {
    let id = identities.get(node);
    if (id === undefined) identities.set(node, (id = ++serial));
    return id;
  };
  const describe = (node: Element) => ({
    tag: node.localName,
    id: node.id,
    role: node.getAttribute('role'),
    classes: node.getAttribute('class'),
    splitSurface: node.hasAttribute('data-pui-split-surface'),
    hasShadowRoot: !!node.shadowRoot,
    rootHost: (node.getRootNode() as ShadowRoot).host?.localName ?? null,
    isContent: node === element,
    isSurface: node === surface,
    connected: node.isConnected,
  });
  const facts = (node: Element, css = view.getComputedStyle(node)) => {
    return {
      node: identity(node),
      tag: node.localName,
      id: node.id,
      class: (node.getAttribute('class') ?? '').slice(0, 320),
      part: node.getAttribute('part'),
      slot: node.getAttribute('slot'),
      isContent: node === element,
      isSurface: node === surface,
      connected: node.isConnected,
      scrollTop: node.scrollTop,
      scrollLeft: node.scrollLeft,
      clientHeight: node.clientHeight,
      clientWidth: node.clientWidth,
      scrollHeight: node.scrollHeight,
      scrollWidth: node.scrollWidth,
      overflowX: css.overflowX,
      overflowY: css.overflowY,
      overscrollX: css.overscrollBehaviorX,
      overscrollY: css.overscrollBehaviorY,
      display: css.display,
      position: css.position,
      contain: css.contain,
      scrollSnapType: css.scrollSnapType,
      scrollBehavior: css.scrollBehavior,
    };
  };
  const scrolls: Array<{
    target: Element;
    snapshot: ReturnType<typeof describe>;
    trusted: boolean;
    timeStamp: number;
    observedAt: number;
    top: number;
    left: number;
  }> = [];
  const scrollTargets = new Set<EventTarget>();
  let droppedScrolls = 0;
  const onScroll = (event: Event) => {
    if (disposed) return;
    const path = event.composedPath();
    // Handle one propagation only at its outermost observed target. Retaining
    // Event identity would incorrectly drop a legal later redispatch.
    for (let index = path.length - 1; index >= 0; index--) {
      if (!scrollTargets.has(path[index])) continue;
      if (event.currentTarget !== path[index]) return;
      break;
    }
    const origin = path[0] ?? event.target;
    const target =
      origin === document
        ? document.scrollingElement
        : origin instanceof view.Element
          ? origin
          : null;
    if (!target) return;
    if (scrolls.length >= 64) {
      droppedScrolls++;
      return;
    }
    scrolls.push({
      target,
      snapshot: describe(target),
      trusted: event.isTrusted === true,
      timeStamp: event.timeStamp,
      observedAt: view.performance.now(),
      top: target.scrollTop,
      left: target.scrollLeft,
    });
  };
  const watchScrolls = (target: EventTarget) => {
    if (disposed || scrollTargets.has(target)) return;
    scrollTargets.add(target);
    target.addEventListener('scroll', onScroll, {
      capture: true,
      passive: true,
    });
  };
  const watchPath = (nodes: readonly EventTarget[]) => {
    for (const node of nodes) {
      if (node instanceof view.ShadowRoot && node.mode === 'open') watchScrolls(node);
      if (node instanceof view.Element) {
        identity(node);
        const root = node.getRootNode();
        if (root instanceof view.ShadowRoot && root.mode === 'open') watchScrolls(root);
      }
    }
  };
  watchScrolls(document);
  watchScrolls(surface);
  watchScrolls(surface.getRootNode());
  const wheels: Array<{
    event: WheelEvent;
    path: Element[];
    surfaceInPath: boolean;
    contentInPath: boolean;
  }> = [];
  const onWheel = (event: WheelEvent) => {
    if (disposed || wheels.length >= 8) return;
    const path = event.composedPath();
    // Preserve dispatch identities before the path disappears. Read CSS and
    // geometry only from read(), not while native wheel dispatch is in flight.
    watchPath(path);
    wheels.push({
      event,
      path: path.filter((node): node is Element => node instanceof view.Element),
      surfaceInPath: path.includes(surface),
      contentInPath: path.includes(element),
    });
    // Native dispatch can perform a microtask checkpoint before a later
    // listener. Retain the event and sample cancellation on each later read,
    // rather than freezing a potentially premature capture/microtask value.
  };
  document.addEventListener('wheel', onWheel, { capture: true, passive: true });
  const hitAt = (x: number, y: number) => {
    let hit = document.elementFromPoint(x, y);
    while (hit?.shadowRoot) {
      const inner = hit.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === hit) break;
      hit = inner;
    }
    return hit;
  };
  const parent = (node: Node): Node | null =>
    (node as Element).assignedSlot ??
    node.parentNode ??
    (node.getRootNode() as ShadowRoot).host ??
    null;
  const pathFrom = (hit: Element | null, limit = Infinity) => {
    const path: Element[] = [];
    const visited = new Set<Node>();
    for (let node: Node | null = hit; node && !visited.has(node) && path.length < limit; ) {
      visited.add(node);
      if (node instanceof view.Element) path.push(node);
      node = parent(node);
    }
    return path;
  };
  const read = (currentDialog: Element | null = element) => {
    const rect = surface.getBoundingClientRect();
    const host = element.getBoundingClientRect();
    const css = view.getComputedStyle(surface);
    const hostCss = view.getComputedStyle(element);
    const availableHeight = Number.parseFloat(
      hostCss.getPropertyValue('--proto-ui-available-height')
    );
    const availableWidth = Number.parseFloat(
      hostCss.getPropertyValue('--proto-ui-available-width')
    );
    const sameSurface =
      surface ===
      (element.shadowRoot?.querySelector<HTMLElement>('[data-pui-split-surface]') ?? element);
    const connected = element.isConnected && surface.isConnected;
    const sameDialog = currentDialog === element;
    const positioned =
      Number.isFinite(availableHeight) &&
      availableHeight > 0 &&
      Number.isFinite(availableWidth) &&
      availableWidth > 0;
    const visible =
      connected &&
      sameDialog &&
      sameSurface &&
      surface.clientHeight > 0 &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= -1 &&
      rect.top >= -1 &&
      rect.right <= view.innerWidth + 1 &&
      rect.bottom <= view.innerHeight + 1 &&
      css.display !== 'none' &&
      css.visibility !== 'hidden';
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    // Document hit testing can retarget to an outer custom element; follow
    // open shadow roots and composed ancestry before deciding owner membership.
    const hit = hitAt(x, y);
    const hitPath = pathFrom(hit);
    watchPath(hitPath);
    const hitInContent = hitPath.includes(element) || hitPath.includes(surface);
    return {
      ready: positioned && visible && /^(auto|scroll|overlay)$/.test(css.overflowY),
      positioned,
      visible,
      connected,
      sameDialog,
      sameSurface,
      hitInContent,
      hit: hit ? { tag: hit.localName, id: hit.id, role: hit.getAttribute('role') } : null,
      hitPath: hitPath.map((node) => facts(node)),
      top: surface.scrollTop,
      max: surface.scrollHeight - surface.clientHeight,
      clientHeight: surface.clientHeight,
      scrollHeight: surface.scrollHeight,
      documentY: view.scrollY,
      availableHeight: Number.isFinite(availableHeight) ? availableHeight : null,
      availableWidth: Number.isFinite(availableWidth) ? availableWidth : null,
      overflowY: css.overflowY,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      host: { x: host.x, y: host.y, width: host.width, height: host.height },
      x,
      y,
      wheels: wheels.map(({ event, surfaceInPath, contentInPath }) => ({
        trusted: event.isTrusted === true,
        deltaY: event.deltaY,
        clientX: Number.isFinite(event.clientX) ? event.clientX : null,
        clientY: Number.isFinite(event.clientY) ? event.clientY : null,
        surfaceInPath,
        contentInPath,
        defaultPrevented: event.defaultPrevented,
      })),
      // Styles/offsets here are current snapshot facts for the retained dispatch
      // identities, not a claim that the browser chose any one scrolling box.
      wheelPaths: wheels.map(({ path }) => path.map((node) => facts(node))),
      scrolls: scrolls.map(({ target, snapshot: _snapshot, ...observation }) => ({
        ...observation,
        node: identity(target),
        current: facts(target),
      })),
      droppedScrolls,
    };
  };
  return {
    read,
    // Preserve the detailed pre-input/final report separately. Main's read()
    // fields remain compatible; all path CSS is sampled now, not at dispatch.
    inspect() {
      const rect = surface.getBoundingClientRect();
      const hit = hitAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const chain = pathFrom(hit, 64);
      watchPath(chain);
      const geometry = (node: Element) => {
        const css = view.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          ...facts(node, css),
          ...describe(node),
          top: node.scrollTop,
          left: node.scrollLeft,
          transform: css.transform,
          rect: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        };
      };
      return {
        at: view.performance.now(),
        content: geometry(element),
        surface: geometry(surface),
        hitChain: chain.map(geometry),
        wheelPathGeometry: 'inspection time, not event time',
        wheelPaths: wheels.map(({ event, path }) => ({
          eventTimeStamp: event.timeStamp,
          path: path.map(geometry),
        })),
        scrolls: scrolls.map(({ snapshot, observedAt, timeStamp, trusted, top, left }) => ({
          at: observedAt,
          eventTimeStamp: timeStamp,
          trusted,
          target: { ...snapshot },
          top,
          left,
        })),
        droppedScrolls,
      };
    },
    dispose() {
      disposed = true;
      document.removeEventListener('wheel', onWheel, true);
      for (const target of scrollTargets) target.removeEventListener('scroll', onScroll, true);
      scrollTargets.clear();
    },
  };
}
