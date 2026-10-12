import { snapshotResidentMotion, type ResidentMotionDeclaration } from '@proto.ui/core';
export type MotionVector = readonly number[];
const same = (a: MotionVector, b: MotionVector) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
const snapshotVector = (input: MotionVector): MotionVector => {
  if (!Array.isArray(input) || !input.length) throw new Error('[feedback.motion] Invalid value');
  const values: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const entry = Object.getOwnPropertyDescriptor(input, String(i));
    if (
      !entry ||
      !('value' in entry) ||
      typeof entry.value !== 'number' ||
      !Number.isFinite(entry.value)
    )
      throw new Error('[feedback.motion] Invalid value');
    values.push(entry.value);
  }
  return Object.freeze(values);
};
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
    target(next: MotionVector, now: number, animate = true, presented?: MotionVector) {
      if (disposed) return null;
      time(now);
      next = snapshotVector(next);
      if (!target || !animate || !config.durationMs || target.length !== next.length) {
        target = next;
        from = next;
        reversingStart = next;
        active = false;
        factor = 1;
        return next;
      }
      if (presented && presented.length !== next.length)
        throw new Error('[feedback.motion] Invalid presented value');
      // Only typed, immutable samples acknowledged by the projection owner qualify.
      const current = presented ? snapshotVector(presented) : read(now)!;
      if (same(target, next)) return current;
      let nextFactor = 1;
      if (active && same(reversingStart, next)) {
        let axis = -1,
          largest = 0;
        target.forEach((v, i) => {
          const delta = Math.abs(v - from[i]);
          if (delta > largest) {
            largest = delta;
            axis = i;
          }
        });
        const e =
          presented && axis >= 0
            ? (current[axis] - from[axis]) / (target[axis] - from[axis])
            : cubicProgress(clamp((now - start) / duration), config.easing);
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
