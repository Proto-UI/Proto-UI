// React can retain child components while their Portal host loses and regains
// its physical view or switches out of detached state. Moving the host does not
// re-run those children's layout effects, so publish connection readiness to the
// current owned views explicitly.
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
