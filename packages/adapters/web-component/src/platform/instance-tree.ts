import {
  createInstanceTreeMarkers,
  releaseWebTriggerSurface,
  type LogicalInstanceToken,
} from '@proto.ui/adapter-base';

export { releaseWebTriggerSurface as releaseTriggerSurface } from '@proto.ui/adapter-base';

export const {
  PROTO_INSTANCE: __WC_PROTO_INSTANCE,
  createLogicalInstance,
  markProtoInstance,
  unbindProtoInstance,
  setProtoParent,
  getProtoParent,
  getPrototypeByInstance,
  getLogicalParent,
  getLogicalRoot,
  getLogicalPrototype,
  mergeLogicalTriggerGroup,
  getLogicalTriggerGroupAnchor,
  setLogicalEventRouteOwner,
  getLogicalEventRouteOwner,
  getLogicalEventRouteSurfaceForTarget,
  resolveLogicalTriggerEventRouteForTarget,
  getLogicalTriggerSurfaceOwner,
  getLogicalTriggerSurfaceRoot,
  subscribeLogicalTriggerSurface,
  getLogicalEventTarget,
  bindLogicalEventTarget,
  unbindLogicalEventTarget,
} = createInstanceTreeMarkers('@proto.ui/adapter-web-component/__proto_instance', {
  releaseTriggerSurface: releaseWebTriggerSurface,
});

type NativeFocusReadiness = {
  isReady(): boolean;
  getNativeTarget?(): HTMLElement | null;
  subscribe(listener: () => void): () => void;
};
type NativeFocusReadinessSlot = {
  source: NativeFocusReadiness | null;
  listeners: Set<() => void>;
};

const nativeFocusReadiness = new WeakMap<LogicalInstanceToken, NativeFocusReadinessSlot>();

function readinessSlot(instance: LogicalInstanceToken): NativeFocusReadinessSlot {
  let slot = nativeFocusReadiness.get(instance);
  if (!slot) {
    slot = { source: null, listeners: new Set() };
    nativeFocusReadiness.set(instance, slot);
  }
  return slot;
}

export function registerNativeFocusReadiness(
  instance: LogicalInstanceToken,
  source: NativeFocusReadiness,
  options?: { deferPublication?: boolean }
): (() => void) & { publish(): void } {
  const slot = readinessSlot(instance);
  slot.source = source;
  const notify = () => {
    let failed = false;
    let firstError: unknown;
    for (const listener of Array.from(slot.listeners)) {
      try {
        listener();
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
      }
    }
    if (failed) throw firstError;
  };
  const release = () => {
    if (slot.source !== source) return;
    slot.source = null;
    notify();
  };
  const publish = () => {
    if (slot.source === source) notify();
  };
  // Adapters first retain this release lease, finish constructing their view,
  // then publish. A throwing focus observer cannot strand an unowned source.
  if (!options?.deferPublication) publish();
  return Object.assign(release, { publish });
}

export function isNativeFocusTargetReady(target: HTMLElement): boolean {
  const owner = getLogicalEventRouteSurfaceForTarget(target);
  return (
    !!owner &&
    (getLogicalRoot(owner) === target ||
      nativeFocusReadiness.get(owner)?.source?.getNativeTarget?.() === target) &&
    nativeFocusReadiness.get(owner)?.source?.isReady() === true
  );
}

// Entry can resolve an ordinary descendant rather than the owner's Root.
// Reuse the same private readiness registry as native Trigger acquisition;
// event-route ownership identifies the view that must observe native focus.
export function isFocusTargetOwnerReady(target: HTMLElement): boolean {
  const owner = getLogicalEventRouteSurfaceForTarget(target);
  return !!owner && nativeFocusReadiness.get(owner)?.source?.isReady() === true;
}

export function subscribeFocusTargetOwnerReady(
  target: HTMLElement,
  listener: () => void
): () => void {
  const initialOwner = getLogicalEventRouteSurfaceForTarget(target);
  if (!initialOwner) return () => {};
  const instance = getLogicalTriggerGroupAnchor(initialOwner);
  // A missing source invalidates entry policy; it is not acquisition readiness.
  // Teardown can precede DOM removal, so re-resolve once after that commit rather
  // than letting an unbound old node borrow its still-ready ancestor's route.
  let disposed = false;
  let invalidationQueued = false;
  let invalidationVersion = 0;
  const release = subscribeFocusSurfaceReady(
    instance,
    () => {
      const owner = getLogicalTriggerSurfaceOwner(instance);
      const source = nativeFocusReadiness.get(owner)?.source;
      if (source?.isReady()) {
        invalidationVersion += 1;
        invalidationQueued = false;
        listener();
      } else if (!source && !invalidationQueued) {
        invalidationQueued = true;
        const version = ++invalidationVersion;
        queueMicrotask(() => {
          if (disposed || version !== invalidationVersion) return;
          invalidationQueued = false;
          const currentOwner = getLogicalTriggerSurfaceOwner(instance);
          if (!nativeFocusReadiness.get(currentOwner)?.source) listener();
        });
      }
    },
    true
  );
  return () => {
    disposed = true;
    invalidationVersion += 1;
    release();
  };
}

export function subscribeFocusSurfaceReady(
  instance: LogicalInstanceToken,
  listener: () => void,
  includeSelf = false
): () => void {
  let disposed = false;
  let owner: LogicalInstanceToken | undefined;
  let releaseReady: (() => void) | undefined;
  let releaseSource: (() => void) | undefined;
  const bindOwner = () => {
    const nextOwner = getLogicalTriggerSurfaceOwner(instance);
    if (owner === nextOwner) return;
    releaseReady?.();
    releaseSource?.();
    releaseReady = undefined;
    releaseSource = undefined;
    owner = nextOwner;
    if (owner === instance && !includeSelf) return;
    const slot = readinessSlot(owner);
    const bindReady = () => {
      releaseReady?.();
      const source = slot.source;
      releaseReady = source?.subscribe(() => {
        if (!disposed && owner === nextOwner && slot.source === source) listener();
      });
    };
    const sourceChanged = () => {
      // A source-change snapshot can outlive this owner binding or subscription.
      if (disposed || owner !== nextOwner) return;
      bindReady();
      listener();
    };
    slot.listeners.add(sourceChanged);
    releaseSource = () => slot.listeners.delete(sourceChanged);
    bindReady();
  };
  bindOwner();
  const releaseSurface = subscribeLogicalTriggerSurface(instance, () => {
    if (disposed) return;
    bindOwner();
    listener();
  });
  return () => {
    if (disposed) return;
    disposed = true;
    releaseSurface();
    releaseReady?.();
    releaseSource?.();
  };
}
