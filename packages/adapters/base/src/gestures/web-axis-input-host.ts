import type {
  AxisInputCancelReason,
  AxisInputConfig,
  AxisInputHost,
  AxisInputHostBinding,
  AxisInputHostLease,
  AxisInputSample,
  MoveGestureHost,
  MoveGestureHostLease,
  MoveGestureSample,
} from '@proto.ui/core';
import { createWebMoveGestureHost } from './web-move-gesture-host';

type Geometry = { origin: number; span: number; sign: 1 | -1 };
type Session = { geometry: Geometry; onSample: AxisInputHostBinding['onSample'] };

function webTarget(value: unknown): HTMLElement {
  if (!(value instanceof HTMLElement))
    throw new TypeError('[AxisInput] Web host requires HTMLElement targets.');
  return value;
}
function geometryOf(target: HTMLElement, config: AxisInputConfig): Geometry | null {
  if (!target.isConnected) return null;
  const rect = target.getBoundingClientRect();
  const origin = config.axis === 'horizontal' ? rect.left : rect.top;
  const span = config.axis === 'horizontal' ? rect.width : rect.height;
  if (!Number.isFinite(origin) || !Number.isFinite(span) || span <= 0) return null;
  const reverse = (config.axis === 'horizontal' && config.direction === 'rtl') !== config.reverse;
  return { origin, span, sign: reverse ? -1 : 1 };
}
function normalized(
  sample: MoveGestureSample,
  config: AxisInputConfig,
  geometry: Geometry,
  phase: 'start' | 'move' | 'end'
): AxisInputSample | null {
  const axis = config.axis === 'horizontal' ? 'x' : 'y';
  const rawPosition = (sample.position[axis] - geometry.origin) / geometry.span;
  const delta = (sample.delta[axis] / geometry.span) * geometry.sign;
  const totalDelta = (sample.totalDelta[axis] / geometry.span) * geometry.sign;
  if (![rawPosition, delta, totalDelta].every(Number.isFinite)) return null;
  return Object.freeze({
    phase,
    position: Math.min(1, Math.max(0, geometry.sign === 1 ? rawPosition : 1 - rawPosition)),
    delta,
    totalDelta,
  });
}
function sameConfig(a: AxisInputConfig, b: AxisInputConfig): boolean {
  return (
    a.axis === b.axis &&
    a.direction === b.direction &&
    a.reverse === b.reverse &&
    a.disabled === b.disabled &&
    a.readOnly === b.readOnly
  );
}

/** Web-only conversion. DOM geometry and Move samples never leave this host. */
export function createWebAxisInputHost(
  move: MoveGestureHost = createWebMoveGestureHost()
): AxisInputHost {
  return {
    attach(initial): AxisInputHostLease {
      let binding = initial;
      let input = webTarget(binding.inputTarget);
      let geometryTarget = webTarget(binding.geometryTarget);
      let moveLease: MoveGestureHostLease | null = null;
      let session: Session | null = null;
      let pending: Geometry | null = null;
      let observer: MutationObserver | null = null;
      let epoch = 0;
      let disposed = false;
      const stopObserver = () => {
        observer?.disconnect();
        observer = null;
      };
      const terminate = (reason: AxisInputCancelReason) => {
        const old = session;
        session = null;
        pending = null;
        stopObserver();
        old?.onSample(Object.freeze({ phase: 'cancel', reason }));
      };
      const connect = () => {
        if (disposed || binding.config.disabled || binding.config.readOnly) return;
        const currentEpoch = epoch;
        const lease = move.attach({
          target: input,
          axis: binding.config.axis,
          activation: 'immediate',
          shouldStart(sample) {
            if (disposed || currentEpoch !== epoch || !input.isConnected) return false;
            pending = geometryOf(geometryTarget, binding.config);
            return !!pending && !!normalized(sample, binding.config, pending, 'start');
          },
          onStart(sample) {
            if (disposed || currentEpoch !== epoch || !pending) return;
            session = { geometry: pending, onSample: binding.onSample };
            pending = null;
            const event = normalized(sample, binding.config, session.geometry, 'start');
            if (!event) {
              restart('invalid-geometry');
              return;
            }
            if (typeof MutationObserver === 'function') {
              observer = new MutationObserver(() => {
                if (session && (!input.isConnected || !geometryTarget.isConnected))
                  restart('target-detached');
              });
              observer.observe(geometryTarget.ownerDocument.documentElement, {
                childList: true,
                subtree: true,
              });
            }
            session.onSample(event);
          },
          onMove(sample) {
            receive(sample, 'move', currentEpoch);
          },
          onEnd(sample) {
            receive(sample, 'end', currentEpoch);
          },
          onCancel(reason) {
            if (currentEpoch === epoch) terminate(reason);
          },
        });
        if (disposed || currentEpoch !== epoch) lease.dispose();
        else moveLease = lease;
      };
      const restart = (reason: AxisInputCancelReason) => {
        const currentEpoch = ++epoch;
        const lease = moveLease;
        moveLease = null;
        lease?.dispose();
        terminate(reason);
        if (currentEpoch === epoch) connect();
      };
      const receive = (sample: MoveGestureSample, phase: 'move' | 'end', currentEpoch: number) => {
        const current = session;
        if (disposed || currentEpoch !== epoch || !current) return;
        if (!input.isConnected || !geometryTarget.isConnected) {
          restart('target-detached');
          return;
        }
        if (!geometryOf(geometryTarget, binding.config)) {
          restart('invalid-geometry');
          return;
        }
        const event = normalized(sample, binding.config, current.geometry, phase);
        if (!event) {
          restart('invalid-geometry');
          return;
        }
        if (phase === 'end') {
          session = null;
          stopObserver();
        }
        current.onSample(event);
      };
      connect();
      return {
        update(next) {
          if (disposed) return;
          const nextInput = webTarget(next.inputTarget);
          const nextGeometry = webTarget(next.geometryTarget);
          const replaced = input !== nextInput || geometryTarget !== nextGeometry;
          const changed = !sameConfig(binding.config, next.config);
          binding = next;
          input = nextInput;
          geometryTarget = nextGeometry;
          if (replaced || changed)
            restart(
              replaced
                ? 'target-replaced'
                : next.config.disabled || next.config.readOnly
                  ? 'disabled'
                  : 'configuration-changed'
            );
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          restart('disposed');
        },
      };
    },
  };
}
