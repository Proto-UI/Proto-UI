import {
  beginOwnedRelocationDiagnostic,
  recordOwnedRelocationDiagnostic,
} from './owned-relocation-diagnostics';
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
/** Scope one synchronous DOM mutation that can detach the captured caller target. */
type OwnedMove = <T>(roots: readonly Node[], move: () => T) => T;
const windows = new WeakMap<Node, Window>();
const parentOf = (node: Node): Node | null =>
  node.parentNode ?? (node.nodeType === 11 && 'host' in node ? (node as ShadowRoot).host : null);
function isWithinComposedRoot(node: Node, root: Node): boolean {
  for (let current: Node | null = node; current; current = parentOf(current)) {
    if (current === root) return true;
  }
  return false;
}
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
  const owned = !!target && roots.some((root) => isWithinComposedRoot(target, root));
  const owner = target ? getLogicalEventRouteSurfaceForTarget(target) : null;
  let blocked = !owned || !!target?.isContentEditable;
  let ownedMoveDepth = 0;
  let targetRefocused = false;
  const diagnostic = beginOwnedRelocationDiagnostic();
  recordOwnedRelocationDiagnostic(
    diagnostic,
    'capture',
    !owned ? 'not-owned' : blocked ? 'contenteditable' : 'eligible'
  );
  let restoring = false;
  const onFocus = (event: Event) => {
    if (!restoring) {
      const elsewhere = !event.composedPath().includes(target!);
      recordOwnedRelocationDiagnostic(diagnostic, 'focusin:elsewhere', elsewhere);
      if (elsewhere) {
        blocked = true;
        recordOwnedRelocationDiagnostic(diagnostic, 'blocked', 'focusin-elsewhere');
      } else targetRefocused = true;
    }
  };
  const onBlur = (event: Event) => {
    // Native removal may dispatch focusout before the moved subtree is detached.
    // Only the exact adapter DOM operation may classify that attached blur as transport.
    if (!restoring) {
      const connected = target?.isConnected;
      const includesTarget = event.composedPath().includes(target!);
      recordOwnedRelocationDiagnostic(diagnostic, 'focusout:connected-at-gate', connected ?? false);
      if (connected && includesTarget && ownedMoveDepth > 0 && !targetRefocused) {
        recordOwnedRelocationDiagnostic(diagnostic, 'focusout:owned-move', true);
      } else if (connected && includesTarget) {
        blocked = true;
        recordOwnedRelocationDiagnostic(diagnostic, 'blocked', 'attached-focusout');
      }
    }
  };
  const move: OwnedMove = (movingRoots, operation) => {
    const transportsTarget =
      owned && !!target && movingRoots.some((root) => isWithinComposedRoot(target, root));
    if (!transportsTarget) return operation();
    ownedMoveDepth++;
    recordOwnedRelocationDiagnostic(diagnostic, 'owned-move:before', movingRoots.length);
    try {
      return operation();
    } finally {
      recordOwnedRelocationDiagnostic(diagnostic, 'owned-move:after', movingRoots.length);
      ownedMoveDepth--;
    }
  };
  if (owned) {
    doc!.addEventListener('focusin', onFocus, true);
    doc!.addEventListener('focusout', onBlur, true);
  }
  return {
    move,
    restore(isCurrent: (node: Node) => boolean) {
      // Preserve the original short-circuit order and read every predicate once.
      if (blocked) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'blocked');
        return;
      }
      if (!target) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'no-target');
        return;
      }
      if (!doc) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'no-document');
        return;
      }
      if (!target.isConnected) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'disconnected');
        return;
      }
      if (target.ownerDocument !== doc) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'document-changed');
        return;
      }
      if (!isCurrent(target)) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'not-current-transport');
        return;
      }
      if (getLogicalEventRouteSurfaceForTarget(target) !== owner) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'owner-changed');
        return;
      }
      if (owner !== null && !isFocusTargetOwnerReady(target)) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'owner-not-ready');
        return;
      }
      if (pathToRoot(target).some((node) => windows.get(node)?.revoked)) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'revoked-window');
        return;
      }
      if (target.matches(':disabled')) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'disabled');
        return;
      }
      if (
        pathToRoot(target).some(
          (node) => node.nodeType === 1 && (node as Element).hasAttribute('inert')
        )
      ) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'inert-ancestor');
        return;
      }
      const current = doc.activeElement;
      if (
        current &&
        current !== doc.body &&
        current !== doc.documentElement &&
        current !== target
      ) {
        recordOwnedRelocationDiagnostic(diagnostic, 'reject', 'different-active-element');
        return;
      }
      if (current === target) {
        recordOwnedRelocationDiagnostic(diagnostic, 'return', 'already-focused');
        return;
      }
      restoring = true;
      try {
        recordOwnedRelocationDiagnostic(diagnostic, 'focus-call', 'before');
        target.focus({ preventScroll: true });
        recordOwnedRelocationDiagnostic(diagnostic, 'focus-call', 'after');
        // Native text controls retain selection in the same node. Do not replay
        // a saved range after focus() author handlers: they may change value,
        // type or selection, or redirect focus deliberately.
      } finally {
        restoring = false;
      }
    },
    dispose() {
      recordOwnedRelocationDiagnostic(diagnostic, 'dispose');
      if (owned) {
        doc!.removeEventListener('focusin', onFocus, true);
        doc!.removeEventListener('focusout', onBlur, true);
      }
    },
  };
}
/**
 * stagingRoot is replaced by destination; otherwise roots are direct destination children.
 * Each physical DOM mutation must use the supplied move scope so native blur is attributed only
 * to the exact adapter-owned transport operation.
 */
export function withWebComponentOwnedRelocation<T>(
  roots: readonly Node[],
  destination: Node,
  move: (runOwnedMove: OwnedMove) => T,
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
    const result = move(focus.move);
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
