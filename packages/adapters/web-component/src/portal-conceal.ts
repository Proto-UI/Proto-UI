import { isWebComponentPortaled } from './portal-mount';

/** Let a hidden portal leave the compositor before revoking its projection.
 * Removing animation styles and reparenting in the conceal microtask can paint
 * one opaque stale layer in Chromium. A rendering opportunity, not an animation
 * duration or a forced layout read, separates those host operations.
 */
export function createPortalConcealBarrier(host: HTMLElement) {
  let pending: (() => void) | null = null;
  return {
    cancel() {
      const waiting = pending !== null;
      pending?.();
      return waiting;
    },
    wait(): Promise<void> | null {
      pending?.();
      const doc = host.ownerDocument;
      const view = doc.defaultView;
      if (
        !isWebComponentPortaled(host) ||
        !host.isConnected ||
        doc.visibilityState !== 'visible' ||
        typeof view?.requestAnimationFrame !== 'function'
      )
        return null;
      return new Promise((resolve) => {
        let frame: number;
        const finish = () => {
          if (pending !== finish) return;
          pending = null;
          view.cancelAnimationFrame(frame);
          doc.removeEventListener('visibilitychange', onVisibility);
          resolve();
        };
        const onVisibility = () => {
          if (doc.visibilityState !== 'visible') finish();
        };
        pending = finish;
        doc.addEventListener('visibilitychange', onVisibility);
        frame = view.requestAnimationFrame(() => {
          if (pending !== finish) return;
          frame = view.requestAnimationFrame(finish);
        });
      });
    },
  };
}
