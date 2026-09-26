import type { ShadowOwnerShell } from './shadow-owner-shell';

export type ShadowInnerSurface = {
  readonly element: HTMLElement;
  replaceRenderedChildren(nodes: readonly Node[]): void;
  clearRenderedChildren(): void;
  hasOnlyRenderedNode(node: Node): boolean;
  dispose(): void;
};

const innerSurfaces = new WeakMap<ShadowRoot, ShadowInnerSurface>();

/**
 * Creates the stable presentation container needed by a future split profile.
 *
 * The container is owner-lived while its children are view-epoch material.
 * It remains private until the split profile can atomically provide style
 * delivery and role-aware Root projection.
 */
export function createShadowInnerSurface(shell: ShadowOwnerShell): ShadowInnerSurface {
  const current = innerSurfaces.get(shell.root);
  if (current) {
    shell.attachOwnerNode(current.element);
    return current;
  }

  const element = shell.root.ownerDocument.createElement('div');
  let renderedNodes: Node[] = [];
  let disposed = false;
  shell.attachOwnerNode(element);

  const assertActive = () => {
    if (disposed) {
      throw new Error('shadow-inner:disposed');
    }
  };

  const clearRenderedChildren = () => {
    element.replaceChildren();
    renderedNodes = [];
  };

  const surface: ShadowInnerSurface = {
    element,
    replaceRenderedChildren(nodes) {
      assertActive();
      shell.attachOwnerNode(element);
      // Replacing an equivalent native slot removes assigned content from the
      // flattened tree and cancels its CSS transitions, even if consumer Node
      // identities never change. Preserve the validated slot-only view within
      // an epoch. This is split-local; detach/remount still clears the view.
      const previous = renderedNodes[0];
      const nextSlot = nodes[0];
      if (
        nodes.length === 1 &&
        renderedNodes.length === 1 &&
        element.childNodes.length === 1 &&
        previous?.parentNode === element &&
        previous.nodeType === 1 &&
        (previous as Element).localName === 'slot' &&
        nextSlot?.isEqualNode(previous)
      )
        return;
      clearRenderedChildren();
      const next = Array.from(nodes);
      element.replaceChildren(...next);
      renderedNodes = next;
    },
    clearRenderedChildren() {
      assertActive();
      clearRenderedChildren();
    },
    hasOnlyRenderedNode(node) {
      assertActive();
      return renderedNodes.length === 1 && renderedNodes[0] === node && node.parentNode === element;
    },
    dispose() {
      if (disposed) return;
      clearRenderedChildren();
      disposed = true;
      shell.detachOwnerNode(element);
      if (innerSurfaces.get(shell.root) === surface) innerSurfaces.delete(shell.root);
    },
  };

  innerSurfaces.set(shell.root, surface);
  return surface;
}
