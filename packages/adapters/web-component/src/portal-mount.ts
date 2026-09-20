/** Document-local WC portal projection. Logical origin owns its liveness;
 * a physical body child follows connected adoption and must not outlive a disconnected origin subtree.
 * No open-state writes or Runtime disposal here: restore the DOM projection
 * and let normal Custom Element disconnection settle the owner lifetime.
 */
const activeProjections = new WeakSet<HTMLElement>();

function isShadowRootNode(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && !!(node as ShadowRoot).host;
}

export function isWebComponentPortaled(el: HTMLElement): boolean {
  return activeProjections.has(el);
}

export function createWebComponentPortalMount() {
  let revoke: (() => void) | null = null;
  return {
    mount(el: HTMLElement) {
      if (revoke || el.parentElement === el.ownerDocument.body) return;
      const parent = el.parentNode;
      if (!parent) return;
      // A stable marker survives while adjacent siblings are portaled. A
      // captured nextSibling does not: restoring A before still-portaled B in
      // [A, B, C] would otherwise append A after C.
      const marker = el.ownerDocument.createComment('proto-ui-portal-origin');
      const descriptor = Object.getOwnPropertyDescriptor(el, 'parentNode');
      let ownsParent = false;
      let projected = false;
      let observer: MutationObserver | null = null;
      let observedDocument: Document | null = null;
      const onMutation = () => {
        // Mutation delivery observes the settled tree, preserving sync moves.
        if (!parent.isConnected || (projected && marker.parentNode !== parent)) revoke?.();
        else observeOriginTrees();
      };
      let observedTrees: Node[] = [];
      function observeOriginTrees() {
        const nextDocument = parent!.ownerDocument ?? el.ownerDocument;
        if (projected && el.ownerDocument !== nextDocument) nextDocument.body?.appendChild(el);
        if (observedDocument !== nextDocument) {
          observer?.disconnect();
          const Observer = nextDocument.defaultView?.MutationObserver ?? MutationObserver;
          observer = new Observer(onMutation);
          observedDocument = nextDocument;
          observedTrees = [];
        }
        const trees: Node[] = [];
        let tree: Node = parent!.getRootNode();
        while (true) {
          trees.push(tree);
          if (!isShadowRootNode(tree)) break;
          tree = tree.host.getRootNode();
        }
        if (trees.length === observedTrees.length && trees.every((t, i) => t === observedTrees[i]))
          return;
        observer!.disconnect();
        for (const tree of trees) observer!.observe(tree, { childList: true, subtree: true });
        observedTrees = trees;
      }
      const restore = () => {
        if (revoke !== restore) return;
        revoke = null;
        const wasProjected = projected;
        projected = false;
        activeProjections.delete(el);
        observer?.disconnect();
        if (ownsParent) {
          if (descriptor) Object.defineProperty(el, 'parentNode', descriptor);
          else delete (el as unknown as { parentNode?: Node }).parentNode;
        }
        if (marker.parentNode === parent) {
          parent.insertBefore(el, marker);
          marker.remove();
        } else if (wasProjected) el.remove();
      };
      revoke = restore;
      try {
        Object.defineProperty(el, 'parentNode', { get: () => parent, configurable: true });
        ownsParent = true;
        // Observe each containing tree: document does not see mutations inside
        // an open ShadowRoot, and that ShadowRoot does not see its host removal.
        observeOriginTrees();
        parent.insertBefore(marker, el);
        el.ownerDocument.body.appendChild(el);
        projected = true;
        activeProjections.add(el);
      } catch (error) {
        restore();
        throw error;
      }
    },
    unmount(_el: HTMLElement) {
      revoke?.();
    },
  };
}
