export type AdapterTaskScheduler = (task: () => void) => void;

/**
 * Schedule work after the Web host has had an opportunity to produce layout.
 * The target supplies the platform realm; callers do not reach through
 * globalThis, and non-visual hosts can provide their normal adapter scheduler.
 * The returned cancellation retires queued frames and suppresses late delivery.
 */
export function scheduleAfterWebLayout(
  target: Element | null,
  task: () => void,
  fallback: AdapterTaskScheduler
): () => void {
  const view = target?.ownerDocument?.defaultView;
  let cancelled = false;
  let frame: number | null = null;
  const run = () => {
    if (cancelled) return;
    frame = null;
    task();
  };
  if (typeof view?.requestAnimationFrame === 'function') {
    frame = view.requestAnimationFrame(() => {
      if (cancelled) return;
      frame = view.requestAnimationFrame(run);
    });
  } else fallback(run);
  return () => {
    cancelled = true;
    if (frame !== null) view?.cancelAnimationFrame(frame);
    frame = null;
  };
}
