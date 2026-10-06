/** Active Web geometry leases share this root-space observation, never a frame poll. */
type RootSpace = Readonly<{
  width: number;
  height: number;
  left: number;
  boxWidth: number;
  boxLeft: number;
}>;
type Tracker = { listeners: Set<() => void>; dispose(): void };
const roots = new WeakMap<Document, Tracker>();
const read = (root: HTMLElement): RootSpace => ({
  width: root.clientWidth,
  height: root.clientHeight,
  left: root.clientLeft,
  boxWidth: root.getBoundingClientRect().width,
  boxLeft: root.getBoundingClientRect().left + (root.ownerDocument.defaultView?.scrollX ?? 0),
});
export function observeRootSpace(document: Document, listener: () => void): () => void {
  const root = document.documentElement,
    view = document.defaultView;
  if (!root || !view) return () => {};
  let tracker = roots.get(document);
  if (!tracker) {
    let previous = read(root),
      disposed = false;
    const listeners = new Set<() => void>();
    const update = () => {
      if (disposed) return;
      const next = read(root);
      if (
        next.width === previous.width &&
        next.height === previous.height &&
        next.left === previous.left &&
        next.boxWidth === previous.boxWidth &&
        next.boxLeft === previous.boxLeft
      )
        return;
      previous = next;
      const errors: unknown[] = [];
      for (const callback of [...listeners]) {
        if (!listeners.has(callback)) continue;
        try {
          callback();
        } catch (error) {
          errors.push(error);
        }
      }
      // Preserve the host callback's surfaced-error policy after notifying
      // independent owners; one failed lease must not starve the others.
      if (errors.length === 1) throw errors[0];
      if (errors.length > 1) throw new AggregateError(errors, 'Root-space subscribers failed');
    };
    const resize =
      typeof view.ResizeObserver === 'function' ? new view.ResizeObserver(update) : null;
    const mutation =
      typeof view.MutationObserver === 'function' ? new view.MutationObserver(update) : null;
    tracker = {
      listeners,
      dispose() {
        disposed = true;
        resize?.disconnect();
        mutation?.disconnect();
        roots.delete(document);
      },
    };
    roots.set(document, tracker);
    // Root width can change without anchor size or a window resize, and an
    // intersection observer need not report a same-size, fully visible anchor.
    resize?.observe(root);
    // Direction/stable-gutter changes can move the origin without resizing.
    mutation?.observe(root, { attributes: true, attributeFilter: ['dir', 'style', 'class'] });
  }
  const owned = tracker;
  const ownedListener = () => listener();
  owned.listeners.add(ownedListener);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owned.listeners.delete(ownedListener);
    if (!owned.listeners.size) owned.dispose();
  };
}
