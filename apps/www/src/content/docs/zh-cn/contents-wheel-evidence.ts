/** Read-only native-browser observations for the retained Contents Popover.
 * This function is serialized by Playwright; keep its closure self-contained. */
export function observeContentsWheel(element: HTMLElement) {
  const document = element.ownerDocument;
  const view = document.defaultView!;
  const surface =
    element.shadowRoot?.querySelector<HTMLElement>('[data-pui-split-surface]') ?? element;
  const wheels: Array<{
    event: WheelEvent;
    path: EventTarget[];
    surfaceInPath: boolean;
    contentInPath: boolean;
  }> = [];
  const onWheel = (event: WheelEvent) => {
    if (wheels.length >= 8) return;
    const path = event.composedPath();
    wheels.push({
      event,
      path,
      surfaceInPath: path.includes(surface),
      contentInPath: path.includes(element),
    });
    // Native dispatch can perform a microtask checkpoint before a later
    // listener. Retain the event and sample cancellation on each later read,
    // rather than freezing a potentially premature capture/microtask value.
  };
  document.addEventListener('wheel', onWheel, { capture: true, passive: true });
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
  const scrolls: Array<{
    at: number;
    eventTimeStamp: number;
    trusted: boolean;
    target: ReturnType<typeof describe>;
    top: number;
    left: number;
  }> = [];
  const scrollRoots = new Set<Node>();
  const seenScrolls = new WeakSet<Event>();
  let disposed = false;
  let droppedScrolls = 0;
  const onScroll = (event: Event) => {
    if (seenScrolls.has(event)) return;
    const target = event.target === document ? document.scrollingElement : event.target;
    if (!(target instanceof view.HTMLElement)) return;
    seenScrolls.add(event);
    if (scrolls.length >= 64) {
      droppedScrolls++;
      return;
    }
    scrolls.push({
      at: view.performance.now(),
      eventTimeStamp: event.timeStamp,
      trusted: event.isTrusted === true,
      target: describe(target),
      top: target.scrollTop,
      left: target.scrollLeft,
    });
  };
  const watchScrollRoot = (root: Node) => {
    if (disposed || scrollRoots.has(root)) return;
    scrollRoots.add(root);
    root.addEventListener('scroll', onScroll, { capture: true, passive: true });
  };
  watchScrollRoot(document);
  watchScrollRoot(surface.getRootNode());
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
    // The public dialog can itself be the split surface inside an open shadow
    // root. Document hit testing retargets that point to the outer custom
    // element; resolve each open root before checking the composed ancestry.
    const hit = hitAt(x, y);
    let hitInContent = false;
    for (let node: Node | null = hit; node; ) {
      if (node === element || node === surface) {
        hitInContent = true;
        break;
      }
      node = parent(node);
    }
    return {
      ready: positioned && visible && /^(auto|scroll|overlay)$/.test(css.overflowY),
      positioned,
      visible,
      connected,
      sameDialog,
      sameSurface,
      hitInContent,
      hit: hit ? { tag: hit.localName, id: hit.id, role: hit.getAttribute('role') } : null,
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
        surfaceInPath,
        contentInPath,
        defaultPrevented: event.defaultPrevented,
      })),
    };
  };
  return {
    read,
    // Kept separate from the original 1000 ms progress poll. Read the actual
    // flattened hit/dispatch paths before input and after completion; the
    // presence of a wheel event alone does not identify its native scroll chain.
    inspect() {
      const rect = surface.getBoundingClientRect();
      const hit = hitAt(rect.left + rect.width / 2, rect.top + rect.height / 2);
      const chain: Element[] = [];
      for (let node: Node | null = hit; node && chain.length < 64; node = parent(node)) {
        if (!(node instanceof view.Element)) continue;
        chain.push(node);
        watchScrollRoot(node.getRootNode());
      }
      const geometry = (node: Element) => {
        const css = view.getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return {
          ...describe(node),
          top: node.scrollTop,
          left: node.scrollLeft,
          clientHeight: node.clientHeight,
          scrollHeight: node.scrollHeight,
          clientWidth: node.clientWidth,
          scrollWidth: node.scrollWidth,
          overflowX: css.overflowX,
          overflowY: css.overflowY,
          overscrollX: css.overscrollBehaviorX,
          overscrollY: css.overscrollBehaviorY,
          position: css.position,
          display: css.display,
          contain: css.contain,
          transform: css.transform,
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
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
          path: path.filter((node): node is Element => node instanceof view.Element).map(geometry),
        })),
        scrolls: [...scrolls],
        droppedScrolls,
      };
    },
    dispose() {
      disposed = true;
      document.removeEventListener('wheel', onWheel, true);
      for (const root of scrollRoots) root.removeEventListener('scroll', onScroll, true);
    },
  };
}
