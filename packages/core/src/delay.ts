import { getActiveRuntimeDelayContext } from './internal';

export type DelayCallback = () => void;

export interface DelayTask {
  cancel(): void;
}

export function delay(durationMs: number, callback: DelayCallback): DelayTask {
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    throw new Error('[Delay] durationMs must be a non-negative finite number.');
  }

  if (typeof callback !== 'function') {
    throw new Error('[Delay] callback must be a function.');
  }

  const ctx = getActiveRuntimeDelayContext();
  if (!ctx) {
    throw new Error(
      '[Delay] delay() is runtime-only and requires an active runtime callback context.'
    );
  }

  return ctx.scheduleDelay(durationMs, callback);
}
