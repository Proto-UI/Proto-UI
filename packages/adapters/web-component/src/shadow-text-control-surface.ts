import type { WebTextControl } from '@proto.ui/module-text-control';
import type { ShadowInnerSurface } from './shadow-inner-surface';
import type { ShadowOwnerShell } from './shadow-owner-shell';

/** Native editor identity is retained; its DOM attachment is a view lease.
 * Never clear textarea children: they carry the browser's defaultValue.
 */
export function createShadowTextControlSurface(
  shell: ShadowOwnerShell,
  element: WebTextControl
): ShadowInnerSurface {
  let disposed = false;
  const assertActive = () => {
    if (disposed) throw new Error('[WC Adapter] native Shadow surface is disposed.');
  };
  // Identity is owner-lived, but initial absence must not acquire a view lease.
  // The first successful view commit attaches the native editor below.
  return {
    element,
    replaceRenderedChildren(nodes) {
      assertActive();
      if (nodes.length !== 1 || nodes[0] !== element)
        throw new Error('[WC Adapter] native Shadow surface accepts only its editor.');
      // attachOwnerNode is idempotent, preserving focus/selection on commits.
      shell.attachOwnerNode(element);
    },
    hasOnlyRenderedNode(node) {
      assertActive();
      return node === element && element.parentNode === shell.root;
    },
    clearRenderedChildren() {
      assertActive();
      shell.detachOwnerNode(element);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      shell.detachOwnerNode(element);
    },
  };
}
