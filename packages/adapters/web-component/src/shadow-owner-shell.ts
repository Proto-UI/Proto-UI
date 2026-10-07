export type ShadowOwnerShell = {
  readonly root: ShadowRoot;
  attachOwnerNode(node: Node): void;
  detachOwnerNode(node: Node): void;
  replaceRenderedChildren(nodes: readonly Node[]): void;
  clearRenderedChildren(): void;
  hasOnlyRenderedNode(node: Node): boolean;
};

/**
 * Separates ShadowRoot owner resources from repeatable view-epoch children.
 *
 * The shell deliberately installs no DOM node by itself, preserving the
 * current shadow:true shape. Future owner-lifetime resources such as a local
 * stylesheet can be attached without being removed by Template commits.
 */
export function createShadowOwnerShell(root: ShadowRoot): ShadowOwnerShell {
  const ownerNodes = new Set<Node>();
  let renderedNodes: Node[] = [];

  const clearRenderedChildren = () => {
    for (const node of renderedNodes) {
      if (node.parentNode === root) root.removeChild(node);
    }
    renderedNodes = [];
  };

  const firstConnectedRenderedNode = (): Node | null =>
    renderedNodes.find((node) => node.parentNode === root) ?? null;

  return {
    root,
    attachOwnerNode(node) {
      if (ownerNodes.has(node) && node.parentNode === root) return;
      ownerNodes.add(node);
      root.insertBefore(node, firstConnectedRenderedNode());
    },
    detachOwnerNode(node) {
      ownerNodes.delete(node);
      if (node.parentNode === root) root.removeChild(node);
    },
    replaceRenderedChildren(nodes) {
      clearRenderedChildren();
      const next = Array.from(nodes);
      root.append(...next);
      renderedNodes = next;
    },
    clearRenderedChildren,
    hasOnlyRenderedNode(node) {
      return renderedNodes.length === 1 && renderedNodes[0] === node && node.parentNode === root;
    },
  };
}
