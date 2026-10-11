import { snapshotResidentMotion, type ResidentMotionDeclaration } from '@proto.ui/core';
export type MotionVector = readonly number[];
const same = (a: MotionVector, b: MotionVector) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** Invert cubic x, then evaluate cubic y. No clock, host or side effects. */
export function cubicProgress(x: number, curve: ResidentMotionDeclaration['easing']): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const cubic = (t: number, a: number, b: number) =>
    3 * (1 - t) * (1 - t) * t * a + 3 * (1 - t) * t * t * b + t * t * t;
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 48; i++) {
    const mid = (lo + hi) / 2;
    if (cubic(mid, curve[0], curve[2]) < x) lo = mid;
    else hi = mid;
  }
  return cubic((lo + hi) / 2, curve[1], curve[3]);
}
export function createResidentMotionSampler(
  config: Pick<ResidentMotionDeclaration, 'durationMs' | 'easing'>
) {
  config = snapshotResidentMotion({ ...config, properties: ['translate'] });
  let target: MotionVector | null = null,
    from: MotionVector = [],
    reversingStart: MotionVector = [];
  let start = 0,
    duration = 0,
    factor = 1,
    lastTime = -Infinity,
    active = false,
    disposed = false;
  function time(now: number) {
    if (!Number.isFinite(now) || now < lastTime)
      throw new Error('[feedback.motion] Nonmonotonic time');
    lastTime = now;
  }
  function read(now: number) {
    if (!target) return null;
    if (!active) return target;
    const p = clamp((now - start) / duration);
    const e = cubicProgress(p, config.easing);
    const value = Object.freeze(target.map((v, i) => from[i] + (v - from[i]) * e));
    if (p === 1) active = false;
    return value;
  }
  return {
    target(next: MotionVector, now: number, animate = true) {
      if (disposed) return null;
      time(now);
      if (!next.length || next.some((v) => !Number.isFinite(v)))
        throw new Error('[feedback.motion] Invalid value');
      next = Object.freeze([...next]);
      if (!target || !animate || !config.durationMs || target.length !== next.length) {
        target = next;
        from = next;
        reversingStart = next;
        active = false;
        factor = 1;
        return next;
      }
      const current = read(now)!;
      if (same(target, next)) return current;
      let nextFactor = 1;
      if (active && same(reversingStart, next)) {
        const e = cubicProgress(clamp((now - start) / duration), config.easing);
        nextFactor = clamp(Math.abs(e * factor + 1 - factor));
        reversingStart = target;
      } else reversingStart = current;
      from = current;
      target = next;
      start = now;
      factor = nextFactor;
      duration = config.durationMs * factor;
      active = duration > 0 && !same(from, target);
      return active ? current : target;
    },
    sample(now: number) {
      if (disposed) return null;
      time(now);
      return read(now);
    },
    settle(now: number) {
      if (disposed) return null;
      time(now);
      active = false;
      factor = 1;
      return target;
    },
    get active() {
      return active && !disposed;
    },
    dispose() {
      disposed = true;
      active = false;
      target = null;
      from = [];
      reversingStart = [];
    },
  };
}
