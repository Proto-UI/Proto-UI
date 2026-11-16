/** Only display:none and the HTML hidden attribute defer first activation.
 * Offscreen, transparent and hover-revealed controls remain eager. */
export function isFirstActivationVisible(root: HTMLElement): boolean {
  return readFirstActivationVisible(root);
}

function readFirstActivationVisible(
  root: HTMLElement,
  display?: Map<HTMLElement, boolean>
): boolean {
  const view = root.ownerDocument.defaultView;
  if (!view || !root.isConnected || root.closest('[hidden]')) return false;
  const ancestors: HTMLElement[] = [];
  for (let element: HTMLElement | null = root; element; element = element.parentElement)
    ancestors.push(element);
  // An ancestor can reject a whole hidden subtree without computing each
  // descendant's style. Preserve the existing parentElement boundary.
  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const element = ancestors[index]!;
    let visible = display?.get(element);
    if (visible === undefined) {
      visible = view.getComputedStyle(element).display !== 'none';
      display?.set(element, visible);
    }
    if (!visible) return false;
  }
  return true;
}

/** Pending roots share ancestor-only attribute observation. Runtime-internal
 * style/class writes do not wake this gate. Active owners belong to consumers. */
export function createHiddenFirstActivation(
  doc: Document,
  activate: (root: HTMLElement) => void
): { add(root: HTMLElement): void; dispose(): void } {
  const view = doc.defaultView!;
  const pending = new Set<HTMLElement>();
  let disposed = false;
  let observing = false;
  let resizeFrame = 0;
  const tryActivate = (root: HTMLElement, display = new Map<HTMLElement, boolean>()) => {
    if (disposed) return;
    if (!root.isConnected) pending.delete(root);
    else if (readFirstActivationVisible(root, display)) {
      pending.delete(root);
      // Only hidden-root reads can share facts. An activation may synchronously
      // change styles, move roots, dispose this gate or reenter add(); no later
      // read may reuse a fact from before that application callback.
      display.clear();
      try {
        activate(root);
      } finally {
        display.clear();
      }
    }
  };
  const observeAncestors = () => {
    visibility.disconnect();
    const ancestors = new Set<HTMLElement>();
    for (const root of pending) {
      for (let node: HTMLElement | null = root; node; node = node.parentElement)
        ancestors.add(node);
    }
    for (const node of ancestors)
      visibility.observe(node, {
        attributes: true,
        attributeFilter: ['hidden', 'style', 'class'],
      });
    if (pending.size && !observing) {
      observing = true;
      structure.observe(doc.documentElement, { childList: true, subtree: true });
      view.addEventListener('resize', onResize);
    } else if (!pending.size && observing) {
      observing = false;
      structure.disconnect();
      view.removeEventListener('resize', onResize);
      view.cancelAnimationFrame(resizeFrame);
      resizeFrame = 0;
    }
  };
  const visibility = new view.MutationObserver((records) => {
    if (disposed) return;
    const previous = pending.size;
    const display = new Map<HTMLElement, boolean>();
    for (const root of pending) {
      if (records.some((record) => record.target.contains(root))) tryActivate(root, display);
    }
    if (pending.size !== previous) observeAncestors();
  });
  const structure = new view.MutationObserver((records) => {
    if (disposed) return;
    let changed = false;
    const display = new Map<HTMLElement, boolean>();
    for (const root of pending) {
      if (!root.isConnected) {
        pending.delete(root);
        changed = true;
      } else if (
        records.some((record) => Array.from(record.addedNodes).some((node) => node.contains(root)))
      ) {
        tryActivate(root, display);
        changed = true;
      }
    }
    if (changed) observeAncestors();
  });
  const onResize = () => {
    if (resizeFrame) return;
    resizeFrame = view.requestAnimationFrame(() => {
      resizeFrame = 0;
      if (disposed) return;
      const previous = pending.size;
      const display = new Map<HTMLElement, boolean>();
      for (const root of pending) tryActivate(root, display);
      if (pending.size !== previous) observeAncestors();
    });
  };
  return {
    add(root) {
      if (disposed || pending.has(root) || !root.isConnected) return;
      pending.add(root);
      tryActivate(root);
      observeAncestors();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      visibility.disconnect();
      structure.disconnect();
      view.removeEventListener('resize', onResize);
      view.cancelAnimationFrame(resizeFrame);
      pending.clear();
    },
  };
}
