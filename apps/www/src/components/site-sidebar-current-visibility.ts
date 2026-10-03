/** One route-entry layout request. Article identity remains Starlight's native
 * aria-current=page link; this helper never owns selection, focus or navigation. */
const owners = new WeakMap<HTMLElement, () => void>();

export function nearestSidebarScroller(
  link: HTMLElement,
  boundary: HTMLElement
): HTMLElement | null {
  const view = boundary.ownerDocument.defaultView;
  if (!view || !boundary.contains(link)) return null;
  for (let node = link.parentElement; node && boundary.contains(node); node = node.parentElement) {
    const style = view.getComputedStyle(node);
    if (
      node.clientHeight > 0 &&
      node.scrollHeight > node.clientHeight &&
      /^(auto|scroll|overlay)$/.test(style.overflowY)
    )
      return node;
    if (node === boundary) break;
  }
  return null;
}

export function nearestEdgeScrollTop(input: {
  top: number;
  bottom: number;
  viewportTop: number;
  viewportHeight: number;
  scrollTop: number;
  scrollHeight: number;
}): number {
  const { top, bottom, viewportTop, viewportHeight, scrollTop, scrollHeight } = input;
  const end = viewportTop + viewportHeight;
  const delta =
    top < viewportTop || bottom - top > viewportHeight
      ? top - viewportTop
      : bottom > end
        ? bottom - end
        : 0;
  return Math.max(0, Math.min(Math.max(0, scrollHeight - viewportHeight), scrollTop + delta));
}

export function initSidebarCurrentVisibility(boundary: HTMLElement): () => void {
  const existing = owners.get(boundary);
  if (existing) return existing;
  const document = boundary.ownerDocument;
  const view = document.defaultView;
  if (!view) return () => {};
  let alive = true;
  let current: HTMLAnchorElement | null = null;
  let pending = true;
  let yielded = false;
  let projectionSeen = false;
  let fontsReady = !document.fonts || document.fonts.status === 'loaded';
  let frame: number | undefined;
  let stableFrames = 0;
  let previousGeometry = '';
  let measured = false;
  let expectedScroll: { owner: HTMLElement; top: number } | null = null;
  const currentLink = () =>
    boundary.querySelector<HTMLAnchorElement>('.top-level a[aria-current="page"]');
  const cancelFrame = () => {
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    frame = undefined;
  };
  const yieldToUser = () => {
    yielded = true;
    pending = false;
    cancelFrame();
  };
  const schedule = () => {
    if (!alive || !pending || yielded || frame !== undefined) return;
    frame = view.requestAnimationFrame(measure);
  };
  const request = () => {
    if (current) resize?.unobserve(current);
    current = currentLink();
    if (current) resize?.observe(current);
    pending = true;
    yielded = false;
    measured = false;
    expectedScroll = null;
    stableFrames = 0;
    previousGeometry = '';
    projectionSeen = current?.dataset.siteLinkEnhanced === 'true';
    if (current) {
      for (
        let node = current.parentElement;
        node && boundary.contains(node);
        node = node.parentElement
      ) {
        if (node instanceof view.HTMLDetailsElement) node.open = true;
        if (node === boundary) break;
      }
    }
    schedule();
  };
  function measure() {
    frame = undefined;
    if (!alive || !pending || yielded) return;
    if (!boundary.isConnected) {
      destroy();
      return;
    }
    if (!current) {
      pending = false;
      return;
    }
    if (!current.isConnected || current !== currentLink()) {
      request();
      return;
    }
    const rect = current.getBoundingClientRect();
    // A closed mobile drawer waits for its real opening event, without polling.
    if (rect.width <= 0 || rect.height <= 0 || current.closest('[hidden]')) return;
    const owner = nearestSidebarScroller(current, boundary);
    if (!owner) {
      pending = false;
      return;
    }
    const viewport = owner.getBoundingClientRect();
    const top = nearestEdgeScrollTop({
      top: rect.top,
      bottom: rect.bottom,
      viewportTop: viewport.top + owner.clientTop,
      viewportHeight: owner.clientHeight,
      scrollTop: owner.scrollTop,
      scrollHeight: owner.scrollHeight,
    });
    measured = true;
    if (Math.abs(top - owner.scrollTop) > 0.5) {
      expectedScroll = { owner, top };
      owner.scrollTop = top;
      stableFrames = 0;
    }
    const geometry = [
      rect.top,
      rect.bottom,
      viewport.top,
      owner.clientHeight,
      owner.scrollHeight,
      owner.scrollTop,
    ].join('/');
    stableFrames = geometry === previousGeometry ? stableFrames + 1 : 0;
    previousGeometry = geometry;
    const surfacePending =
      current.hasAttribute('data-site-native-link') && !current.querySelector('[data-pui-style]');
    if (!fontsReady || surfacePending) return; // actual font/projection observations resume work
    if (stableFrames >= 2) {
      pending = false;
      return;
    }
    schedule();
  }
  const mutations = new view.MutationObserver(() => {
    if (!alive) return;
    if (currentLink() !== current) {
      request();
      return;
    }
    if (yielded) return;
    const projected = current?.dataset.siteLinkEnhanced === 'true';
    if (projected && !projectionSeen) {
      projectionSeen = true;
      pending = true;
      stableFrames = 0;
    }
    schedule();
  });
  mutations.observe(boundary, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['aria-current', 'open', 'data-site-link-enhanced', 'data-pui-style'],
  });
  const resize =
    typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(schedule) : null;
  resize?.observe(boundary);
  const open = () => {
    if (!yielded) {
      pending = true;
      stableFrames = 0;
      schedule();
    }
  };
  const pageShow = (event: PageTransitionEvent) => {
    if (event.persisted) request();
  };
  const keydown = (event: KeyboardEvent) => {
    if (
      ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Tab', 'Enter'].includes(
        event.key
      )
    )
      yieldToUser();
  };
  const scroll = (event: Event) => {
    if (!measured || !(event.target instanceof view.HTMLElement)) return;
    if (
      expectedScroll?.owner === event.target &&
      Math.abs(event.target.scrollTop - expectedScroll.top) <= 0.5
    )
      return;
    yieldToUser();
  };
  function destroy() {
    if (!alive) return;
    alive = false;
    cancelFrame();
    mutations.disconnect();
    resize?.disconnect();
    boundary.removeEventListener('wheel', yieldToUser);
    boundary.removeEventListener('touchstart', yieldToUser);
    boundary.removeEventListener('pointerdown', yieldToUser);
    boundary.removeEventListener('keydown', keydown);
    boundary.removeEventListener('scroll', scroll, true);
    document.removeEventListener('site-contents:open', open);
    document.removeEventListener('astro:before-swap', destroy);
    view?.removeEventListener('pageshow', pageShow);
    owners.delete(boundary);
  }
  boundary.addEventListener('wheel', yieldToUser, { passive: true });
  boundary.addEventListener('touchstart', yieldToUser, { passive: true });
  boundary.addEventListener('pointerdown', yieldToUser, { passive: true });
  boundary.addEventListener('keydown', keydown);
  boundary.addEventListener('scroll', scroll, true);
  document.addEventListener('site-contents:open', open);
  document.addEventListener('astro:before-swap', destroy);
  view.addEventListener('pageshow', pageShow);
  document.fonts?.ready.then(() => {
    if (alive && !yielded) {
      fontsReady = true;
      pending = true;
      stableFrames = 0;
      schedule();
    }
  });
  owners.set(boundary, destroy);
  request();
  return destroy;
}

export function initSiteSidebarCurrentVisibility(document: Document): void {
  document.querySelectorAll<HTMLElement>('.docs-sidebar').forEach(initSidebarCurrentVisibility);
}
