import {
  getPrototypeByInstance,
  isProtoInstance,
  markProtoInstance,
} from './platform/instance-tree';

/** Document-local WC portal projection. Logical origin owns its liveness;
 * a physical body child follows connected adoption and must not outlive a disconnected origin subtree.
 * No open-state writes or Runtime disposal here: restore the DOM projection
 * and let normal Custom Element disconnection settle the owner lifetime.
 */
const activeProjections = new WeakSet<HTMLElement>();
const adoptedProjections = new WeakMap<HTMLElement, Set<(document: Document) => void>>();
const projectionByOriginMarker = new WeakMap<Node, HTMLElement>();
const originMarkerByProjection = new WeakMap<HTMLElement, Node>();

function isShadowRootNode(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && !!(node as ShadowRoot).host;
}

export function isWebComponentPortaled(el: HTMLElement): boolean {
  return activeProjections.has(el);
}

/** Resolves only a currently active projection at its logical origin point. */
export function getWebComponentPortalProjectionForOrigin(node: Node): HTMLElement | null {
  const projection = projectionByOriginMarker.get(node);
  return projection && activeProjections.has(projection) ? projection : null;
}

/** True only when target is physically inside an active projection whose
 * logical origin remains beneath root (including an open ShadowRoot chain). */
export function isWebComponentPortalTargetOwnedBy(root: Node, target: Element): boolean {
  let projection: Element | null = target;
  while (projection && !activeProjections.has(projection as HTMLElement))
    projection = projection.parentElement;
  const origin = projection ? originMarkerByProjection.get(projection as HTMLElement) : undefined;
  let current: Node | null = origin ?? null;
  while (current) {
    if (current === root) return true;
    current = isShadowRootNode(current) ? current.host : current.parentNode;
  }
  return false;
}

export function adoptWebComponentPortalProjections(owner: HTMLElement, document: Document): void {
  for (const adopt of adoptedProjections.get(owner) ?? []) adopt(document);
}

function findPortalOwner(node: Node): HTMLElement | null {
  let current: Node | null = node;
  while (current) {
    if (isProtoInstance(current)) return current;
    current = isShadowRootNode(current) ? current.host : current.parentNode;
  }
  return null;
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
      let unbindAdoption: (() => void) | null = null;
      let observer: MutationObserver | null = null;
      let observedDocument: Document | null = null;
      const adopt = (document: Document) => {
        if (el.ownerDocument !== document) document.body?.appendChild(el);
        observeOriginTrees();
        // adoptNode() may not be followed by a synchronous reconnect.
        // Retain the established checkpoint cleanup in that case.
        queueMicrotask(onMutation);
      };
      const bindAdoption = () => {
        unbindAdoption?.();
        const owner = findPortalOwner(parent);
        if (!owner) return;
        const adoptions = adoptedProjections.get(owner) ?? new Set();
        adoptions.add(adopt);
        adoptedProjections.set(owner, adoptions);
        unbindAdoption = () => {
          adoptions.delete(adopt);
          if (!adoptions.size) adoptedProjections.delete(owner);
        };
      };
      const onMutation = () => {
        // Mutation delivery observes the settled tree, preserving sync moves.
        if (!parent.isConnected || (projected && marker.parentNode !== parent)) revoke?.();
        else {
          const proto = getPrototypeByInstance(el);
          const token = (el as any)._instanceToken;
          if (proto && token) markProtoInstance(el, proto, token, true);
          bindAdoption();
          observeOriginTrees();
        }
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
        unbindAdoption?.();
        const wasProjected = projected;
        projected = false;
        projectionByOriginMarker.delete(marker);
        originMarkerByProjection.delete(el);
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
        bindAdoption();
        Object.defineProperty(el, 'parentNode', { get: () => parent, configurable: true });
        ownsParent = true;
        // Observe each containing tree: document does not see mutations inside
        // an open ShadowRoot, and that ShadowRoot does not see its host removal.
        observeOriginTrees();
        parent.insertBefore(marker, el);
        el.ownerDocument.body.appendChild(el);
        projected = true;
        activeProjections.add(el);
        projectionByOriginMarker.set(marker, el);
        originMarkerByProjection.set(el, marker);
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
