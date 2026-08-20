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
};

type TargetStyleSnapshot = Readonly<{
  touchAction: string;
  userSelect: string;
}>;

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
      let active: ActiveMove | null = null;
      let detachObserver: MutationObserver | null = null;
      let styleSnapshot: TargetStyleSnapshot | null = null;

      const stopDetachObserver = () => {
        detachObserver?.disconnect();
        detachObserver = null;
      };

      const releaseCapture = (current: ActiveMove | null) => {
        if (!current) return;
        try {
          if (target.hasPointerCapture?.(current.pointerId)) {
            target.releasePointerCapture(current.pointerId);
          }
        } catch {
          // The host may already have released ownership during teardown.
        }
      };

      const cancel = (reason: MoveGestureCancelReason) => {
        const current = active;
        if (!current) return;
        active = null;
        stopDetachObserver();
        releaseCapture(current);
        binding.onCancel(reason);
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
        if (disposed || active || !target.isConnected || !isPrimaryContact(event)) return;
        const startSample = sampleOf(event);
        if (binding.shouldStart && !binding.shouldStart(startSample)) return;

        event.preventDefault();
        const start = startSample.position;
        active = {
          pointerId: event.pointerId,
          input: startSample.input,
          start,
          last: start,
        };
        try {
          target.setPointerCapture?.(event.pointerId);
        } catch {
          // Capture is a Web strategy, not a portable precondition. Continue
          // with the stream the host can provide and cancel if ownership is lost.
        }
        observeDetach();
        binding.onStart(startSample);
      };

      const onPointerMove = (event: PointerEvent) => {
        const current = active;
        if (!current || event.pointerId !== current.pointerId) return;
        if (!target.isConnected) {
          cancel('target-detached');
          return;
        }
        event.preventDefault();
        const next = sampleOf(event, current);
        current.last = next.position;
        binding.onMove(next);
      };

      const onPointerUp = (event: PointerEvent) => {
        const current = active;
        if (!current || event.pointerId !== current.pointerId) return;
        if (!target.isConnected) {
          cancel('target-detached');
          return;
        }
        event.preventDefault();
        const endSample = sampleOf(event, current);
        active = null;
        stopDetachObserver();
        releaseCapture(current);
        binding.onEnd(endSample);
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
        styleSnapshot = Object.freeze({
          touchAction: target.style.touchAction,
          userSelect: target.style.userSelect,
        });
        target.style.touchAction = 'none';
        target.style.userSelect = 'none';
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
        if (styleSnapshot) {
          target.style.touchAction = styleSnapshot.touchAction;
          target.style.userSelect = styleSnapshot.userSelect;
        }
        styleSnapshot = null;
      };

      connect();

      return {
        update(nextBinding) {
          if (disposed) return;
          const nextTarget = requireWebTarget(nextBinding.target);
          if (nextTarget === target) {
            binding = nextBinding;
            return;
          }
          cancel('target-replaced');
          disconnect();
          binding = nextBinding;
          target = nextTarget;
          connect();
        },
        dispose() {
          if (disposed) return;
          cancel('disposed');
          disposed = true;
          stopDetachObserver();
          disconnect();
        },
      };
    },
  };
}
