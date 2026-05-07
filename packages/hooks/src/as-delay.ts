import { getActiveAsHookContext } from '@proto.ui/core/internal';

export type DelayHandle = {
  /**
   * Return a monotonic-ish timestamp for coordination.
   * This is intentionally centralized so it can be replaced
   * by a host-provided clock later.
   */
  now(): number;
  /**
   * Schedule a callback after `ms`.
   * Returns a cancel function.
   */
  after(ms: number, cb: () => void): () => void;
};

/**
 * Centralized timing abstraction for prototypes.
 *
 * NOTE:
 * - Official prototypes should not scatter direct timer usage (setTimeout, microtasks, etc.).
 * - This hook intentionally centralizes the behavior so it can be swapped with a
 *   host/runtime-provided scheduler in the future.
 */
export function asDelay(): DelayHandle {
  const { rt } = getActiveAsHookContext('asDelay');
  rt.ensureSetup(`asHook(asDelay)`);
  rt.register('asDelay', { privileged: false, mode: 'once' });

  return {
    now() {
      return Date.now();
    },
    after(ms, cb) {
      const delay = typeof ms === 'number' && Number.isFinite(ms) ? Math.max(0, ms) : 0;
      const id = globalThis.setTimeout(cb, delay);
      return () => {
        globalThis.clearTimeout(id);
      };
    },
  };
}
