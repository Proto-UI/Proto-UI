import {
  beginWebPortalMaterialEpoch,
  getWebPortalDestinationGeneration,
  resolveWebPortalDestinationBinding,
  subscribeWebPortalDestinations,
  notifyWebPortalProjection,
  type WebPortalDestinationBinding,
  type WebPortalMaterialEpoch,
} from '@proto.ui/adapter-base';
import {
  getPrototypeByInstance,
  isProtoInstance,
  markProtoInstance,
  setProtoParent,
} from './platform/instance-tree';

/** Document-local WC portal projection. Logical origin owns its liveness;
 * a physical body child follows connected adoption and must not outlive a disconnected origin subtree.
 * No open-state writes or Runtime disposal here: restore the DOM projection
 * and let normal Custom Element disconnection settle the owner lifetime.
 */
export { isWebComponentOwnedRelocating as isWebComponentPortalRelocating } from './owned-relocation';
import { withWebComponentOwnedRelocation } from './owned-relocation';
function relocate(el: HTMLElement, destination: Node, move: () => void): void {
  withWebComponentOwnedRelocation([el], destination, move);
}
const refreshProjections = new WeakMap<HTMLElement, () => void>();
export function refreshWebComponentPortalProjection(el: HTMLElement): void {
  refreshProjections.get(el)?.();
}

const activeProjections = new WeakMap<HTMLElement, (restoreToOrigin?: boolean) => void>();
// A retired mount can synchronously create another mount for the same host.
// Keep its last epoch even after retirement: a replacement that also retires
// must not make an older cleanup authoritative again.
const projectionEpochs = new WeakMap<HTMLElement, object>();
const adoptedProjections = new WeakMap<HTMLElement, Set<(document: Document) => void>>();
const projectionByOriginMarker = new WeakMap<Node, HTMLElement>();
const originMarkerByProjection = new WeakMap<HTMLElement, Node>();

function isShadowRootNode(node: Node): node is ShadowRoot {
  return node.nodeType === 11 && !!(node as ShadowRoot).host;
}

export function isWebComponentPortaled(el: HTMLElement): boolean {
  return activeProjections.has(el);
}

/** Confirmed owner disconnection withdraws projection without reconnecting it. */
export function abandonWebComponentPortalProjection(el: HTMLElement): void {
  activeProjections.get(el)?.(false);
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
  while (projection && !activeProjections.has(projection as HTMLElement)) {
    const tree = projection.getRootNode();
    projection =
      projection.parentElement ?? (isShadowRootNode(tree) ? (tree.host as Element) : null);
  }
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

function portalLogicalParent(node: Node): HTMLElement | null {
  if (node.nodeType === 1) return node as HTMLElement;
  return isShadowRootNode(node) ? (node.host as HTMLElement) : null;
}

export function createWebComponentPortalMount() {
  let revoke: (() => void) | null = null;
  let idleProjection: { retire: () => void } | null = null;
  const releaseIdle = () => {
    const idle = idleProjection;
    idleProjection = null;
    idle?.retire();
  };
  return {
    mount(el: HTMLElement) {
      if (revoke) return;
      const parent = el.parentNode;
      if (!parent) return;
      // A direct body child can still belong to an explicitly registered body
      // scene. This preflight has no lease yet: host reads may synchronously
      // mount, move or retire this target, so never supersede their ownership.
      if (parent === el.ownerDocument.body) {
        const previousEpoch = projectionEpochs.get(el);
        const revision = getWebPortalDestinationGeneration();
        const initial = resolveWebPortalDestinationBinding(parent, el);
        if (revoke || el.parentNode !== parent || projectionEpochs.get(el) !== previousEpoch)
          return;
        // A superseded read returns body as a safety fallback. It cannot prove
        // the current policy is a no-op; the guarded acquisition below resolves it.
        if (revision === getWebPortalDestinationGeneration() && initial.destination === parent) {
          if (idleProjection) return;
          const epoch = {};
          projectionEpochs.set(el, epoch);
          let material: WebPortalMaterialEpoch | null = null;
          let off = () => {};
          const idle = {
            retire() {
              off();
              material?.release();
            },
          };
          idleProjection = idle;
          const current = () => idleProjection === idle && projectionEpochs.get(el) === epoch;
          const refresh = () => {
            if (!current()) return;
            if (
              el.parentNode !== parent ||
              !el.isConnected ||
              el.ownerDocument !== parent.ownerDocument
            ) {
              material?.suspend();
              return;
            }
            const next = resolveWebPortalDestinationBinding(parent, el);
            if (
              current() &&
              (next.destination !== initial.destination ||
                next.registration !== initial.registration)
            )
              material?.suspend();
          };
          try {
            const acquired = beginWebPortalMaterialEpoch(el);
            if (!current()) {
              acquired.release();
              return;
            }
            material = acquired;
            off = subscribeWebPortalDestinations(refresh);
            refresh();
            if (current() && el.parentNode === parent && el.isConnected)
              material.commitProjection();
          } catch (error) {
            if (idleProjection === idle) idleProjection = null;
            idle.retire();
            throw error;
          }
          return;
        }
      }
      const beforeIdleRelease = projectionEpochs.get(el);
      releaseIdle();
      if (
        revoke ||
        idleProjection ||
        el.parentNode !== parent ||
        projectionEpochs.get(el) !== beforeIdleRelease
      )
        return;
      const epoch = {};
      projectionEpochs.set(el, epoch);
      const isCurrent = () => revoke === restore && projectionEpochs.get(el) === epoch;
      // A stable marker survives while adjacent siblings are portaled. A
      // captured nextSibling does not: restoring A before still-portaled B in
      // [A, B, C] would otherwise append A after C.
      const marker = el.ownerDocument.createComment('proto-ui-portal-origin');
      let projected = false;
      let projectionBody: HTMLElement | null = null;
      let binding: WebPortalDestinationBinding | null = null;
      let materialEpoch: WebPortalMaterialEpoch | null = null;
      const ownsProjection = () => projected && el.parentNode === projectionBody;
      let unbindAdoption: (() => void) | null = null;
      let observer: MutationObserver | null = null;
      let observedDocument: Document | null = null;
      let offDestination = () => {};
      const refreshDestination = () => {
        if (!isCurrent()) return;
        if (!ownsProjection() || !marker.isConnected || !projectionBody?.isConnected) {
          materialEpoch?.suspend();
          return;
        }
        const registryRevision = getWebPortalDestinationGeneration();
        const next = resolveWebPortalDestinationBinding(marker, el);
        if (
          registryRevision !== getWebPortalDestinationGeneration() ||
          !isCurrent() ||
          !ownsProjection()
        )
          return;
        // The selected physical parent is fixed for this view epoch. A policy
        // change revokes optical admission without remove/reinsert blur, even
        // when that policy later switches back to the original destination.
        if (
          next.destination !== binding?.destination ||
          next.registration !== binding?.registration
        )
          materialEpoch?.suspend();
      };
      const transferProjection = (document: Document): boolean => {
        const previousBody = projectionBody;
        if (!isCurrent() || !ownsProjection() || !document.body) return false;
        if (el.ownerDocument === document) return true;
        // Document adoption is an existing lifecycle boundary, not a claimed
        // focus-preserving destination switch. Its old pixel lease is unusable.
        materialEpoch?.suspend();
        if (!isCurrent() || !ownsProjection()) return false;
        document.adoptNode(el);
        // Adoption invokes author callbacks synchronously. The old lease may
        // have retired, or an external owner may have taken the node already.
        if (!isCurrent()) return false;
        if (
          projectionBody !== previousBody ||
          el.parentNode !== null ||
          el.ownerDocument !== document ||
          marker.parentNode !== parent ||
          parent.ownerDocument !== document
        ) {
          restore();
          return false;
        }
        binding = resolveWebPortalDestinationBinding(marker, el);
        if (!isCurrent()) return false;
        projectionBody = binding.destination;
        projectionBody.appendChild(el);
        if (isCurrent() && ownsProjection()) notifyWebPortalProjection(el);
        return isCurrent() && ownsProjection();
      };
      const adopt = (document: Document) => {
        if (!isCurrent()) return;
        if (!ownsProjection()) {
          revoke?.();
          return;
        }
        if (!transferProjection(document)) return;
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
        if (!isCurrent()) return;
        // Mutation delivery observes the settled tree, preserving sync moves.
        if (
          !parent.isConnected ||
          (projected && (marker.parentNode !== parent || !ownsProjection()))
        )
          revoke?.();
        else {
          const proto = getPrototypeByInstance(el);
          const token = (el as any)._instanceToken;
          if (proto && token) {
            setProtoParent(el, portalLogicalParent(parent));
            if (!isCurrent()) return;
            markProtoInstance(el, proto, token);
            if (!isCurrent()) return;
          }
          bindAdoption();
          observeOriginTrees();
          refreshDestination();
        }
      };
      let observedTrees: Node[] = [];
      function observeOriginTrees() {
        if (!isCurrent()) return;
        const nextDocument = parent!.ownerDocument ?? el.ownerDocument;
        if (projected && el.ownerDocument !== nextDocument && !transferProjection(nextDocument))
          return;
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
      const restore = (restoreToOrigin = true) => {
        if (revoke !== restore) return;
        revoke = null;
        offDestination();
        unbindAdoption?.();
        const wasProjected = projected;
        const ownedProjection = ownsProjection();
        projected = false;
        projectionByOriginMarker.delete(marker);
        if (originMarkerByProjection.get(el) === marker) originMarkerByProjection.delete(el);
        if (activeProjections.get(el) === restore) activeProjections.delete(el);
        if (refreshProjections.get(el) === refreshDestination) refreshProjections.delete(el);
        observer?.disconnect();
        const errors: unknown[] = [];
        const cleanup = (work: () => void) => {
          try {
            work();
          } catch (error) {
            errors.push(error);
          }
        };
        const isLastRetired = () =>
          projectionEpochs.get(el) === epoch && revoke === null && !activeProjections.has(el);
        cleanup(() => materialEpoch?.release());
        // Each synchronous cleanup notification can establish a newer host
        // epoch, including through a different mount instance. Never clear its
        // logical projection, move its node, or publish our stale completion.
        if (isLastRetired()) cleanup(() => setProtoParent(el, null));
        const stillOwned = isLastRetired() && ownedProjection && el.parentNode === projectionBody;
        if (restoreToOrigin && marker.parentNode === parent) {
          if (stillOwned || (isLastRetired() && !wasProjected && el.parentNode === parent))
            cleanup(() => {
              if (el.parentNode !== parent || marker.nextSibling !== el)
                relocate(el, parent, () => parent.insertBefore(el, marker));
            });
        } else if (restoreToOrigin && stillOwned) cleanup(() => el.remove());
        cleanup(() => marker.remove());
        if (isLastRetired()) cleanup(() => notifyWebPortalProjection(el));
        if (errors.length === 1) throw errors[0];
        if (errors.length > 1) throw new AggregateError(errors, 'Portal projection cleanup failed');
      };
      revoke = restore;
      try {
        bindAdoption();
        setProtoParent(el, portalLogicalParent(parent));
        if (!isCurrent()) {
          restore();
          return;
        }
        // Observe each containing tree: document does not see mutations inside
        // an open ShadowRoot, and that ShadowRoot does not see its host removal.
        observeOriginTrees();
        if (!isCurrent()) {
          restore();
          return;
        }
        parent.insertBefore(marker, el);
        if (!isCurrent()) {
          restore();
          return;
        }
        projected = true;
        activeProjections.set(el, restore);
        refreshProjections.set(el, refreshDestination);
        projectionByOriginMarker.set(marker, el);
        originMarkerByProjection.set(el, marker);
        binding = resolveWebPortalDestinationBinding(marker, el);
        if (!isCurrent()) {
          restore();
          return;
        }
        projectionBody = binding.destination;
        offDestination = subscribeWebPortalDestinations(refreshDestination);
        const acquiredMaterial = beginWebPortalMaterialEpoch(el);
        if (!isCurrent()) {
          acquiredMaterial.release();
          restore();
          return;
        }
        materialEpoch = acquiredMaterial;
        if (el.parentNode !== projectionBody)
          relocate(el, projectionBody!, () => projectionBody!.appendChild(el));
        if (isCurrent() && ownsProjection()) {
          refreshDestination();
          if (isCurrent() && ownsProjection()) materialEpoch.commitProjection();
          if (isCurrent() && ownsProjection()) notifyWebPortalProjection(el);
        }
      } catch (error) {
        restore();
        throw error;
      }
    },
    unmount(_el: HTMLElement) {
      releaseIdle();
      revoke?.();
    },
  };
}
