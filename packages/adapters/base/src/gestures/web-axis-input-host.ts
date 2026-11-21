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

type Geometry = { origin: number; span: number; deltaSpan: number; sign: 1 | -1 };
// Summing independently transformed part extents may differ by a few floating
// point ULPs after redistribution. Ignore only arithmetic noise, not CSS-pixel
// or subpixel changes to the accepted contact basis.
const sameExtent = (a: number, b: number) =>
  Math.abs(a - b) <= Number.EPSILON * Math.max(1, Math.abs(a), Math.abs(b)) * 16;
type Session = { geometry: Geometry; onSample: AxisInputHostBinding['onSample']; started: boolean };

function webTarget(value: unknown): HTMLElement {
  if (!(value instanceof HTMLElement))
    throw new TypeError('[AxisInput] Web host requires HTMLElement targets.');
  return value;
}
function axisAligned(target: HTMLElement): boolean {
  const win = target.ownerDocument.defaultView;
  if (!win) return false;
  for (let node: Element | null = target; node; ) {
    const style = win.getComputedStyle(node);
    // A rotated/skewed/perspective layout has no single viewport-axis interval.
    const transform = style.transform;
    if (transform && transform !== 'none') {
      const match = /^matrix\(([^)]+)\)$/.exec(transform);
      if (!match) return false;
      const values = match[1].split(',').map(Number);
      if (
        values.length !== 6 ||
        !values.every(Number.isFinite) ||
        values[0] <= 0 ||
        values[3] <= 0 ||
        values[1] !== 0 ||
        values[2] !== 0
      )
        return false;
    }
    const rotation = style.getPropertyValue('rotate');
    if (rotation && rotation !== 'none' && rotation !== '0deg') return false;
    const scaling = style.getPropertyValue('scale');
    if (scaling && scaling !== 'none') {
      const scales = scaling.trim().split(/\s+/).map(Number);
      if (scales.length > 2 || !scales.every((value) => Number.isFinite(value) && value > 0))
        return false;
    }
    if (style.perspective && style.perspective !== 'none') return false;
    const root = node.getRootNode();
    node = node.parentElement ?? ('host' in root ? (root as ShadowRoot).host : null);
  }
  return true;
}
function geometryOf(
  target: HTMLElement,
  config: AxisInputConfig,
  travel?: HTMLElement,
  deltaBasis?: readonly HTMLElement[]
): Geometry | null {
  if (!target.isConnected) return null;
  const rect = target.getBoundingClientRect();
  const horizontal = config.axis === 'horizontal';
  let origin = horizontal ? rect.left : rect.top;
  let span = horizontal ? rect.width : rect.height;
  if (!Number.isFinite(origin) || !Number.isFinite(span) || span <= 0) return null;
  if (travel) {
    if (
      !travel.isConnected ||
      travel.ownerDocument !== target.ownerDocument ||
      !axisAligned(target) ||
      !axisAligned(travel)
    )
      return null;
    const style = target.ownerDocument.defaultView!.getComputedStyle(target);
    const read = (value: string) => (value === '' ? 0 : Number.parseFloat(value));
    const before =
      read(horizontal ? style.borderLeftWidth : style.borderTopWidth) +
      read(horizontal ? style.paddingLeft : style.paddingTop);
    const after =
      read(horizontal ? style.borderRightWidth : style.borderBottomWidth) +
      read(horizontal ? style.paddingRight : style.paddingBottom);
    const specified = Number.parseFloat(horizontal ? style.width : style.height);
    // Computed CSS extents and border/padding are untransformed. Convert their
    // inset to the same viewport CSS-pixel space as the two measured boxes.
    const cssBorderBox = style.boxSizing === 'border-box' ? specified : specified + before + after;
    if (!Number.isFinite(cssBorderBox) || cssBorderBox <= 0) return null;
    const scale = span / cssBorderBox;
    const handleRect = travel.getBoundingClientRect();
    const handle = horizontal ? handleRect.width : handleRect.height;
    if (
      ![before, after, scale, handle].every(Number.isFinite) ||
      before < 0 ||
      after < 0 ||
      scale <= 0 ||
      handle <= 0
    )
      return null;
    origin += before * scale + handle / 2;
    span -= (before + after) * scale + handle;
    if (!Number.isFinite(origin) || !Number.isFinite(span) || span <= 0) return null;
  }
  let deltaSpan = span;
  if (deltaBasis) {
    if (!deltaBasis.length || !axisAligned(target)) return null;
    deltaSpan = 0;
    for (const part of deltaBasis) {
      if (!part.isConnected || part.ownerDocument !== target.ownerDocument || !axisAligned(part))
        return null;
      const rect = part.getBoundingClientRect();
      const extent = horizontal ? rect.width : rect.height;
      if (!Number.isFinite(extent) || extent < 0) return null;
      deltaSpan += extent;
    }
    if (!Number.isFinite(deltaSpan) || deltaSpan <= 0) return null;
  }
  const reverse = (horizontal && config.direction === 'rtl') !== config.reverse;
  return { origin, span, deltaSpan, sign: reverse ? -1 : 1 };
}

function normalized(
  sample: MoveGestureSample,
  config: AxisInputConfig,
  geometry: Geometry,
  phase: 'start' | 'move' | 'end'
): AxisInputSample | null {
  const axis = config.axis === 'horizontal' ? 'x' : 'y';
  const rawPosition = (sample.position[axis] - geometry.origin) / geometry.span;
  const delta = (sample.delta[axis] / geometry.deltaSpan) * geometry.sign;
  const totalDelta = (sample.totalDelta[axis] / geometry.deltaSpan) * geometry.sign;
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
    a.readOnly === b.readOnly &&
    (a.contactBasis ?? 'preserve-start') === (b.contactBasis ?? 'preserve-start') &&
    (a.activation ?? 'immediate') === (b.activation ?? 'immediate')
  );
}

function validateContactBasis(config: AxisInputConfig): void {
  if (
    config.activation !== undefined &&
    config.activation !== 'immediate' &&
    config.activation !== 'directional'
  )
    throw new TypeError('[AxisInput] Invalid activation policy.');
  if (
    config.contactBasis !== undefined &&
    config.contactBasis !== 'preserve-start' &&
    config.contactBasis !== 'cancel-on-extent-change'
  ) {
    throw new TypeError('[AxisInput] Invalid contactBasis policy.');
  }
}

/** Web-only conversion. DOM geometry and Move samples never leave this host. */
export function createWebAxisInputHost(
  move: MoveGestureHost = createWebMoveGestureHost()
): AxisInputHost {
  return {
    attach(initial): AxisInputHostLease {
      validateContactBasis(initial.config);
      let binding = initial;
      let input = webTarget(binding.inputTarget);
      let geometryTarget = webTarget(binding.geometryTarget);
      let travelTarget =
        binding.travelTarget === undefined ? undefined : webTarget(binding.travelTarget);
      let deltaBasis = binding.deltaBasisTargets?.map(webTarget);
      let moveLease: MoveGestureHostLease | null = null;
      let session: Session | null = null;
      let pending: Geometry | null = null;
      let observer: MutationObserver | null = null;
      let basisFrame: { window: Window; id: number } | null = null;
      let epoch = 0;
      let disposed = false;
      const stopObserver = () => {
        observer?.disconnect();
        observer = null;
        if (basisFrame) basisFrame.window.cancelAnimationFrame(basisFrame.id);
        basisFrame = null;
      };
      const terminate = (reason: AxisInputCancelReason) => {
        const old = session;
        session = null;
        pending = null;
        stopObserver();
        if (old?.started) old.onSample(Object.freeze({ phase: 'cancel', reason }));
      };
      const connect = () => {
        if (disposed || binding.config.disabled || binding.config.readOnly) return;
        const currentEpoch = epoch;
        const lease = move.attach({
          target: input,
          axis: binding.config.axis,
          activation: binding.config.activation ?? 'immediate',
          shouldStart(sample) {
            if (disposed || currentEpoch !== epoch || !input.isConnected) return false;
            if (binding.config.contactBasis === 'cancel-on-extent-change') {
              const win = geometryTarget.ownerDocument.defaultView;
              if (
                !win ||
                typeof win.requestAnimationFrame !== 'function' ||
                typeof win.cancelAnimationFrame !== 'function'
              )
                return false;
            }
            pending = geometryOf(geometryTarget, binding.config, travelTarget, deltaBasis);
            return !!pending && !!normalized(sample, binding.config, pending, 'start');
          },
          onStart(sample) {
            if (disposed || currentEpoch !== epoch || !pending) return;
            session = { geometry: pending, onSample: binding.onSample, started: false };
            pending = null;
            const event = normalized(sample, binding.config, session.geometry, 'start');
            if (!event) {
              restart('invalid-geometry');
              return;
            }
            const current = session;
            if (!validBasis(current, currentEpoch)) return;
            if (typeof MutationObserver === 'function') {
              observer = new MutationObserver(() => {
                if (
                  session === current &&
                  currentEpoch === epoch &&
                  (!input.isConnected ||
                    !geometryTarget.isConnected ||
                    (travelTarget && !travelTarget.isConnected) ||
                    deltaBasis?.some((part) => !part.isConnected))
                )
                  restart('target-detached');
              });
              observer.observe(geometryTarget.ownerDocument.documentElement, {
                childList: true,
                subtree: true,
              });
            }
            observeBasis(current, currentEpoch);
            current.started = true;
            current.onSample(event);
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
      const validBasis = (current: Session, currentEpoch: number): boolean => {
        if (disposed || currentEpoch !== epoch || session !== current) return false;
        if (
          !input.isConnected ||
          !geometryTarget.isConnected ||
          (travelTarget && !travelTarget.isConnected) ||
          deltaBasis?.some((part) => !part.isConnected)
        ) {
          restart('target-detached');
          return false;
        }
        const live = geometryOf(geometryTarget, binding.config, travelTarget, deltaBasis);
        if (disposed || currentEpoch !== epoch || session !== current) return false;
        if (!live) {
          restart('invalid-geometry');
          return false;
        }
        if (
          binding.config.contactBasis === 'cancel-on-extent-change' &&
          (!sameExtent(live.span, current.geometry.span) ||
            !sameExtent(live.deltaSpan, current.geometry.deltaSpan))
        ) {
          restart('basis-changed');
          return false;
        }
        return true;
      };
      const observeBasis = (current: Session, currentEpoch: number) => {
        if (binding.config.contactBasis !== 'cancel-on-extent-change') return;
        const win = geometryTarget.ownerDocument.defaultView!;
        const tick = () => {
          // A cancelled callback can still arrive; it belongs to this contact, not the next one.
          if (disposed || currentEpoch !== epoch || session !== current) return;
          basisFrame = null;
          if (!validBasis(current, currentEpoch)) return;
          basisFrame = { window: win, id: win.requestAnimationFrame(tick) };
        };
        basisFrame = { window: win, id: win.requestAnimationFrame(tick) };
      };
      const receive = (sample: MoveGestureSample, phase: 'move' | 'end', currentEpoch: number) => {
        const current = session;
        if (!current || !validBasis(current, currentEpoch)) return;
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
          validateContactBasis(next.config);
          const nextInput = webTarget(next.inputTarget);
          const nextGeometry = webTarget(next.geometryTarget);
          const nextTravel =
            next.travelTarget === undefined ? undefined : webTarget(next.travelTarget);
          const nextBasis = next.deltaBasisTargets?.map(webTarget);
          const replaced =
            input !== nextInput ||
            geometryTarget !== nextGeometry ||
            travelTarget !== nextTravel ||
            (nextBasis?.length ?? 0) !== (deltaBasis?.length ?? 0) ||
            (nextBasis?.some((part, i) => part !== deltaBasis?.[i]) ?? false);
          const changed = !sameConfig(binding.config, next.config);
          binding = next;
          input = nextInput;
          geometryTarget = nextGeometry;
          travelTarget = nextTravel;
          deltaBasis = nextBasis;
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
