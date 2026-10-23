import {
  getLogicalEventRouteSurfaceForTarget,
  isFocusTargetOwnerReady,
} from './platform/instance-tree';
/** Private synchronous authority for one exact adapter-owned physical move. */
type Window = {
  document: Document;
  path: readonly Node[];
  previous?: Window;
  claimed?: boolean;
  revoked?: boolean;
};
const windows = new WeakMap<Node, Window>();
const parentOf = (node: Node): Node | null =>
  node.parentNode ?? (node.nodeType === 11 && 'host' in node ? (node as ShadowRoot).host : null);
function pathToRoot(node: Node): Node[] {
  const path: Node[] = [];
  for (let current: Node | null = node; current; current = parentOf(current)) path.push(current);
  return path;
}
export function isWebComponentOwnedRelocating(node: Node): boolean {
  const active = windows.get(node);
  if (!active || active.revoked || active.document !== node.ownerDocument) return false;
  const actual = pathToRoot(node);
  return (
    actual.length === active.path.length &&
    actual.every((part, index) => part === active.path[index])
  );
}
/** One reconnect allowance, claimed before any extensible lifecycle hook runs. */
export function claimWebComponentOwnedRelocation(node: Node): (() => boolean) | null {
  const active = windows.get(node);
  if (!active) return null;
  if (active.claimed || !isWebComponentOwnedRelocating(node)) {
    active.revoked = true;
    return null;
  }
  active.claimed = true;
  return () => {
    if (windows.get(node) !== active) return false;
    if (!isWebComponentOwnedRelocating(node)) active.revoked = true;
    return !active.revoked;
  };
}
/** Preserve only a live caller's focus lost by this transport, never steal author focus. */
export function captureWebComponentCallerFocus(roots: readonly Node[]) {
  const doc = roots[0]?.ownerDocument;
  let active = doc?.activeElement as HTMLElement | null | undefined;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement as HTMLElement;
  const target = active;
  const owned = !!target && roots.some((root) => pathToRoot(target).includes(root));
  const owner = target ? getLogicalEventRouteSurfaceForTarget(target) : null;
  let blocked = !owned || !!target?.isContentEditable;
  let restoring = false;
  const onFocus = (event: Event) => {
    if (!restoring && !event.composedPath().includes(target!)) blocked = true;
  };
  const onBlur = (event: Event) => {
    // A deliberate blur while still attached is not transport-induced loss.
    if (!restoring && target?.isConnected && event.composedPath().includes(target)) blocked = true;
  };
  if (owned) {
    doc!.addEventListener('focusin', onFocus, true);
    doc!.addEventListener('focusout', onBlur, true);
  }
  return {
    restore(isCurrent: (node: Node) => boolean) {
      if (
        blocked ||
        !target ||
        !doc ||
        !target.isConnected ||
        target.ownerDocument !== doc ||
        !isCurrent(target) ||
        getLogicalEventRouteSurfaceForTarget(target) !== owner ||
        (owner !== null && !isFocusTargetOwnerReady(target)) ||
        pathToRoot(target).some((node) => windows.get(node)?.revoked) ||
        target.matches(':disabled') ||
        pathToRoot(target).some(
          (node) => node.nodeType === 1 && (node as Element).hasAttribute('inert')
        )
      )
        return;
      const current = doc.activeElement;
      if (current && current !== doc.body && current !== doc.documentElement && current !== target)
        return;
      if (current === target) return;
      restoring = true;
      try {
        target.focus({ preventScroll: true });
        // Native text controls retain selection in the same node. Do not replay
        // a saved range after focus() author handlers: they may change value,
        // type or selection, or redirect focus deliberately.
      } finally {
        restoring = false;
      }
    },
    dispose() {
      if (owned) {
        doc!.removeEventListener('focusin', onFocus, true);
        doc!.removeEventListener('focusout', onBlur, true);
      }
    },
  };
}
/** stagingRoot is replaced by destination; otherwise roots are direct destination children. */
export function withWebComponentOwnedRelocation<T>(
  roots: readonly Node[],
  destination: Node,
  move: () => T,
  stagingRoot?: Node
): T {
  const acquired: Array<[Node, Window]> = [];
  const seen = new Set<Node>();
  const destinationPath = pathToRoot(destination);
  const focus = captureWebComponentCallerFocus(roots);
  const visit = (node: Node, expected: readonly Node[]) => {
    if (seen.has(node)) return;
    seen.add(node);
    if (!node.ownerDocument || destination.ownerDocument !== node.ownerDocument) return;
    const entry = { document: node.ownerDocument, path: expected, previous: windows.get(node) };
    windows.set(node, entry);
    acquired.push([node, entry]);
    for (const child of Array.from(node.childNodes)) visit(child, [child, ...expected]);
    const shadow = (node as Element).shadowRoot;
    if (shadow) visit(shadow, [shadow, ...expected]);
  };
  try {
    for (const root of roots) {
      if (stagingRoot) {
        const path = pathToRoot(root),
          index = path.indexOf(stagingRoot);
        if (index < 1) continue;
        visit(root, [...path.slice(0, index), ...destinationPath]);
      } else visit(root, [root, ...destinationPath]);
    }
    const result = move();
    focus.restore(isWebComponentOwnedRelocating);
    return result;
  } finally {
    focus.dispose();
    for (const [node, entry] of acquired) {
      if (windows.get(node) !== entry) continue;
      if (entry.previous) windows.set(node, entry.previous);
      else windows.delete(node);
    }
  }
}
