import type {
  MoveGestureCancelReason,
  MoveGestureHost,
  MoveGestureHostBinding,
  MoveGestureHostLease,
  MoveGestureInput,
  MoveGesturePoint,
  MoveGestureSample,
} from '@proto.ui/core';

type ActiveMove = {
  pointerId: number;
  input: MoveGestureInput;
  start: MoveGesturePoint;
  last: MoveGesturePoint;
  target: HTMLElement;
  binding: MoveGestureHostBinding;
  started: boolean;
};

type TargetStyleSnapshot = Readonly<{
  touchAction: string;
  userSelect: string;
}>;

// Shared across host factories: one physical contact and one target have one owner.
// Distinct targets may accept distinct contacts. A consumed down event cannot be
// reacquired by an ancestor even if the first owner ends reentrantly.
const contactOwners = new WeakMap<Document, Map<number, ActiveMove>>();
const targetOwners = new WeakMap<HTMLElement, ActiveMove>();
const acceptedDownEvents = new WeakSet<Event>();
const targetStyles = new WeakMap<HTMLElement, { count: number; original: TargetStyleSnapshot }>();

function contacts(target: HTMLElement): Map<number, ActiveMove> {
  let owners = contactOwners.get(target.ownerDocument);
  if (!owners) {
    owners = new Map();
    contactOwners.set(target.ownerDocument, owners);
  }
  return owners;
}
function retainStyles(target: HTMLElement): () => void {
  let entry = targetStyles.get(target);
  if (entry) entry.count++;
  else {
    entry = {
      count: 1,
      original: { touchAction: target.style.touchAction, userSelect: target.style.userSelect },
    };
    targetStyles.set(target, entry);
    target.style.touchAction = 'none';
    target.style.userSelect = 'none';
  }
  return () => {
    if (--entry!.count !== 0) return;
    target.style.touchAction = entry!.original.touchAction;
    target.style.userSelect = entry!.original.userSelect;
    targetStyles.delete(target);
  };
}

function point(event: PointerEvent): MoveGesturePoint {
  return Object.freeze({ x: event.clientX, y: event.clientY });
}

function inputOf(event: PointerEvent): MoveGestureInput {
  if (event.pointerType === 'mouse') return 'mouse';
  if (event.pointerType === 'touch') return 'touch';
  if (event.pointerType === 'pen') return 'pen';
  return 'unknown';
}

function sampleOf(event: PointerEvent, active?: ActiveMove): MoveGestureSample {
  const position = point(event);
  const start = active?.start ?? position;
  const last = active?.last ?? position;
  return Object.freeze({
    input: active?.input ?? inputOf(event),
    position,
    delta: Object.freeze({ x: position.x - last.x, y: position.y - last.y }),
    totalDelta: Object.freeze({ x: position.x - start.x, y: position.y - start.y }),
    timestamp: Number.isFinite(event.timeStamp) ? event.timeStamp : 0,
  });
}

function isPrimaryContact(event: PointerEvent): boolean {
  if (event.pointerType === 'mouse' && event.button !== 0) return false;
  return event.isPrimary !== false;
}

function requireWebTarget(target: unknown): HTMLElement {
  if (!(target instanceof HTMLElement)) {
    throw new TypeError('[MoveGesture] Web host requires an HTMLElement target.');
  }
  return target;
}

/**
 * Web realization of the bounded Move Gesture host capability.
 * Pointer capture, touch-action, DOM targets, and CSS pixels remain local to
 * this implementation and do not enter the portable gesture contract.
 */
export function createWebMoveGestureHost(): MoveGestureHost {
  return {
    attach(initialBinding: MoveGestureHostBinding): MoveGestureHostLease {
      let binding = initialBinding;
      let target = requireWebTarget(binding.target);
      let disposed = false;
      let revision = 0;
      const handledSamples = new WeakSet<Event>();
      let active: ActiveMove | null = null;
      let detachObserver: MutationObserver | null = null;
      let releaseStyles: (() => void) | null = null;
      let releaseGlobalListeners: (() => void) | null = null;

      const stopDetachObserver = () => {
        detachObserver?.disconnect();
        detachObserver = null;
      };

      const releaseCapture = (current: ActiveMove | null) => {
        if (!current) return;
        try {
          if (current.target.hasPointerCapture?.(current.pointerId)) {
            current.target.releasePointerCapture(current.pointerId);
          }
        } catch {
          // The host may already have released ownership during teardown.
        }
      };

      const releaseOwner = (current: ActiveMove) => {
        const owners = contacts(current.target);
        if (owners.get(current.pointerId) === current) owners.delete(current.pointerId);
        if (targetOwners.get(current.target) === current) targetOwners.delete(current.target);
        releaseGlobalListeners?.();
        releaseGlobalListeners = null;
      };

      const cancel = (reason: MoveGestureCancelReason) => {
        const current = active;
        if (!current) return;
        active = null;
        stopDetachObserver();
        releaseOwner(current);
        releaseCapture(current);
        if (current.started) current.binding.onCancel(reason);
      };

      const observeDetach = () => {
        stopDetachObserver();
        if (typeof MutationObserver !== 'function') return;
        const root = target.ownerDocument.documentElement;
        if (!root) return;
        detachObserver = new MutationObserver(() => {
          if (!target.isConnected) cancel('target-detached');
        });
        detachObserver.observe(root, { childList: true, subtree: true });
      };

      const onPointerDown = (event: PointerEvent) => {
        if (
          disposed ||
          active ||
          !target.isConnected ||
          !isPrimaryContact(event) ||
          acceptedDownEvents.has(event) ||
          targetOwners.has(target) ||
          contacts(target).has(event.pointerId)
        )
          return;
        const startSample = sampleOf(event);
        const startingRevision = revision;
        const startingBinding = binding;
        if (startingBinding.shouldStart && !startingBinding.shouldStart(startSample)) return;
        if (
          disposed ||
          active ||
          startingRevision !== revision ||
          !target.isConnected ||
          acceptedDownEvents.has(event) ||
          targetOwners.has(target) ||
          contacts(target).has(event.pointerId)
        )
          return;

        event.preventDefault();
        acceptedDownEvents.add(event);
        const start = startSample.position;
        const current: ActiveMove = {
          pointerId: event.pointerId,
          input: startSample.input,
          start,
          last: start,
          target,
          binding: startingBinding,
          started: false,
        };
        active = current;
        targetOwners.set(target, current);
        contacts(target).set(event.pointerId, current);
        const doc = target.ownerDocument;
        const win = doc.defaultView;
        const onBlur = () => cancel('lost-ownership');
        doc.addEventListener('pointermove', onPointerMove, true);
        doc.addEventListener('pointerup', onPointerUp, true);
        doc.addEventListener('pointercancel', onPointerCancel, true);
        win?.addEventListener('blur', onBlur);
        releaseGlobalListeners = () => {
          doc.removeEventListener('pointermove', onPointerMove, true);
          doc.removeEventListener('pointerup', onPointerUp, true);
          doc.removeEventListener('pointercancel', onPointerCancel, true);
          win?.removeEventListener('blur', onBlur);
        };
        try {
          target.setPointerCapture?.(event.pointerId);
        } catch {
          // Capture is a Web strategy, not a portable precondition. Continue
          // with the stream the host can provide and cancel if ownership is lost.
        }
        if (active !== current || disposed) return;
        if (startingRevision !== revision) {
          cancel('target-replaced');
          return;
        }
        observeDetach();
        current.started = true;
        current.binding.onStart(startSample);
      };

      const onPointerMove = (event: PointerEvent) => {
        const current = active;
        if (!current?.started || event.pointerId !== current.pointerId || handledSamples.has(event))
          return;
        handledSamples.add(event);
        if (!target.isConnected) {
          cancel('target-detached');
          return;
        }
        event.preventDefault();
        const next = sampleOf(event, current);
        current.last = next.position;
        current.binding.onMove(next);
      };

      const onPointerUp = (event: PointerEvent) => {
        const current = active;
        if (!current?.started || event.pointerId !== current.pointerId || handledSamples.has(event))
          return;
        handledSamples.add(event);
        if (!target.isConnected) {
          cancel('target-detached');
          return;
        }
        event.preventDefault();
        const endSample = sampleOf(event, current);
        active = null;
        stopDetachObserver();
        releaseOwner(current);
        releaseCapture(current);
        current.binding.onEnd(endSample);
      };

      const onPointerCancel = (event: PointerEvent) => {
        if (!active || event.pointerId !== active.pointerId) return;
        cancel('host-cancel');
      };

      const onLostPointerCapture = (event: PointerEvent) => {
        if (!active || event.pointerId !== active.pointerId) return;
        cancel('lost-ownership');
      };

      const onNativeDragStart = (event: DragEvent) => event.preventDefault();

      const connect = () => {
        releaseStyles = retainStyles(target);
        target.addEventListener('pointerdown', onPointerDown);
        target.addEventListener('pointermove', onPointerMove);
        target.addEventListener('pointerup', onPointerUp);
        target.addEventListener('pointercancel', onPointerCancel);
        target.addEventListener('lostpointercapture', onLostPointerCapture);
        target.addEventListener('dragstart', onNativeDragStart);
      };

      const disconnect = () => {
        target.removeEventListener('pointerdown', onPointerDown);
        target.removeEventListener('pointermove', onPointerMove);
        target.removeEventListener('pointerup', onPointerUp);
        target.removeEventListener('pointercancel', onPointerCancel);
        target.removeEventListener('lostpointercapture', onLostPointerCapture);
        target.removeEventListener('dragstart', onNativeDragStart);
        releaseStyles?.();
        releaseStyles = null;
      };

      connect();

      return {
        update(nextBinding) {
          if (disposed) return;
          const nextTarget = requireWebTarget(nextBinding.target);
          const currentRevision = ++revision;
          if (nextTarget === target) {
            binding = nextBinding;
            return;
          }
          cancel('target-replaced');
          if (disposed || currentRevision !== revision) return;
          disconnect();
          binding = nextBinding;
          target = nextTarget;
          connect();
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          revision++;
          cancel('disposed');
          stopDetachObserver();
          disconnect();
        },
      };
    },
  };
}
