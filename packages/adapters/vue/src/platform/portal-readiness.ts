// Vue 3 Teleport can retain child components while their Portal host moves out
// of detached state and attaches to the portal destination. Moving the host does
// not invoke those children's updated hooks, so publish connection readiness to
// the current owned views explicitly.
const viewNotifiers = new WeakMap<Element, () => void>();

export function registerPortalViewReadiness(root: HTMLElement, notify: () => void): () => void {
  viewNotifiers.set(root, notify);
  return () => {
    if (viewNotifiers.get(root) === notify) viewNotifiers.delete(root);
  };
}

export function notifyPortalSubtreeReadiness(
  root: HTMLElement,
  isCurrentProjection: () => boolean
): void {
  const views = [root, ...root.querySelectorAll('*')].flatMap((element) => {
    const notify = viewNotifiers.get(element);
    return notify ? [{ element, notify }] : [];
  });
  let failed = false;
  let firstError: unknown;
  for (const { element, notify } of views) {
    if (!isCurrentProjection()) break;
    if (!element.isConnected || !root.contains(element) || viewNotifiers.get(element) !== notify)
      continue;
    try {
      notify();
    } catch (error) {
      if (!failed) {
        failed = true;
        firstError = error;
      }
    }
  }
  if (failed) throw firstError;
}
