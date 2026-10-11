import type { ContextMenuInputIntent, DelayTask } from '@proto.ui/core';
import type { ContextMenuInputHost } from '../caps';
import { createWebInputOriginAnchor } from './input-origin-anchor';

const acceptedEvents = new WeakSet<Event>();
const pendingDownEvents = new WeakSet<Event>();
const cancelledDownEvents = new WeakSet<Event>();
const LONG_PRESS_MS = 600;
const MOVE_TOLERANCE_PX = 10;
const COMPATIBILITY_WINDOW_MS = 800;
type Contact = { id: number; x: number; y: number };

/** Does not capture pointers, prevent ordinary down/up/click, or change touch-action. */
export function createWebContextMenuInputHost(): ContextMenuInputHost {
  return {
    attach(binding) {
      const target = binding.target;
      if (!(target instanceof HTMLElement))
        throw new TypeError('[ContextMenuInput] Web host requires an HTMLElement.');
      const doc = target.ownerDocument;
      const win = doc.defaultView;
      let disabled = binding.disabled;
      let disposed = false;
      let revision = 0;
      let pending: Contact | null = null;
      let pendingTask: DelayTask | null = null;
      let suppressionTask: DelayTask | null = null;
      let suppression: { id: number | null; click: boolean; context: boolean } | null = null;
      let activeAnchor: ReturnType<typeof createWebInputOriginAnchor> | null = null;
      let observer: MutationObserver | null = null;
      const live = () => !disposed && !disabled && target.isConnected;
      const stopPending = () => {
        pending = null;
        const task = pendingTask;
        pendingTask = null;
        task?.cancel();
      };
      const stopSuppression = () => {
        suppression = null;
        const task = suppressionTask;
        suppressionTask = null;
        task?.cancel();
      };
      const reset = () => {
        revision++;
        stopPending();
        stopSuppression();
        const anchor = activeAnchor;
        activeAnchor = null;
        anchor?.dispose();
        observer?.disconnect();
        observer = null;
      };
      const observeDetach = () => {
        if (observer || typeof MutationObserver !== 'function') return;
        observer = new MutationObserver(() => {
          if (!target.isConnected) reset();
        });
        observer.observe(doc.documentElement, { childList: true, subtree: true });
      };
      const suppressCompatibility = (id: number | null, click: boolean) => {
        stopSuppression();
        const current = { id, click, context: true };
        suppression = current;
        // A held contact may outlive the compatibility window. Expire only after
        // release; keyboard intent has no contact and starts its window now.
        if (id === null) expireSuppression(current);
      };
      const expireSuppression = (current: NonNullable<typeof suppression>) => {
        suppressionTask?.cancel();
        suppressionTask = binding.scheduleDelay(COMPATIBILITY_WINDOW_MS, () => {
          if (suppression === current) stopSuppression();
        });
      };
      const emit = (
        origin: ContextMenuInputIntent['origin'],
        point?: { x: number; y: number }
      ): boolean => {
        if (!live() || (point && (!Number.isFinite(point.x) || !Number.isFinite(point.y))))
          return false;
        const version = ++revision;
        const anchor = createWebInputOriginAnchor(target, point);
        observeDetach();
        let accepted = false;
        try {
          accepted = binding.onIntent(Object.freeze({ origin, anchor: anchor.anchor }));
        } finally {
          if (accepted && live() && version === revision) {
            const previous = activeAnchor;
            activeAnchor = anchor;
            previous?.dispose();
          } else anchor.dispose();
        }
        return accepted && live() && version === revision && activeAnchor === anchor;
      };
      const prevent = (event: Event) => {
        if (event.cancelable) event.preventDefault();
        acceptedEvents.add(event);
      };
      const onDocumentDown = (event: PointerEvent) => {
        if (pending) {
          cancelledDownEvents.add(event);
          stopPending();
        }
        // A later real contact starts a new sequence; never swallow its normal click.
        stopSuppression();
      };
      const onDown = (event: PointerEvent) => {
        if (
          !live() ||
          pending ||
          pendingDownEvents.has(event) ||
          cancelledDownEvents.has(event) ||
          event.isPrimary === false ||
          event.button !== 0 ||
          (event.pointerType !== 'touch' && event.pointerType !== 'pen') ||
          !Number.isFinite(event.clientX) ||
          !Number.isFinite(event.clientY)
        )
          return;
        pendingDownEvents.add(event);
        const contact = { id: event.pointerId, x: event.clientX, y: event.clientY };
        pending = contact;
        observeDetach();
        const task = binding.scheduleDelay(LONG_PRESS_MS, () => {
          if (pending !== contact || !live()) return;
          pending = null;
          pendingTask = null;
          if (emit('long-press', contact)) suppressCompatibility(contact.id, true);
        });
        if (pending === contact) pendingTask = task;
        else task.cancel();
      };
      const onMove = (event: PointerEvent) => {
        if (!pending || event.pointerId !== pending.id) return;
        if (
          !Number.isFinite(event.clientX) ||
          !Number.isFinite(event.clientY) ||
          Math.hypot(event.clientX - pending.x, event.clientY - pending.y) > MOVE_TOLERANCE_PX
        )
          stopPending();
      };
      const onRelease = (event: PointerEvent) => {
        if (pending?.id === event.pointerId) stopPending();
        if (suppression?.id === event.pointerId) {
          if (event.type === 'pointercancel') stopSuppression();
          else expireSuppression(suppression);
        }
      };
      const onKey = (event: KeyboardEvent) => {
        if (
          !live() ||
          acceptedEvents.has(event) ||
          event.defaultPrevented ||
          event.repeat ||
          !(event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
        )
          return;
        stopPending();
        stopSuppression();
        if (emit('keyboard')) {
          prevent(event);
          suppressCompatibility(null, false);
        }
      };
      const onContextMenu = (event: MouseEvent) => {
        if (!live() || acceptedEvents.has(event) || event.defaultPrevented) return;
        if (suppression?.context) {
          suppression.context = false;
          prevent(event);
          return;
        }
        const contact = pending;
        stopPending();
        // Native keyboard context-menu without a preceding keydown has button=0 and
        // zero coordinates. Pointer-origin (including the viewport origin) has button=2.
        const keyboard =
          !contact && event.button === 0 && event.clientX === 0 && event.clientY === 0;
        const point = keyboard ? undefined : (contact ?? { x: event.clientX, y: event.clientY });
        if (emit(keyboard ? 'keyboard' : contact ? 'long-press' : 'pointer', point)) {
          prevent(event);
          if (contact) suppressCompatibility(contact.id, true);
        }
      };
      const onClick = (event: MouseEvent) => {
        if (!live() || !suppression?.click || event.button !== 0 || event.detail === 0) return;
        suppression.click = false;
        prevent(event);
        event.stopImmediatePropagation();
      };
      const onAbort = () => {
        stopPending();
        stopSuppression();
      };
      const onVisibility = () => {
        if (doc.visibilityState === 'hidden') onAbort();
      };
      target.addEventListener('pointerdown', onDown);
      target.addEventListener('contextmenu', onContextMenu);
      target.addEventListener('keydown', onKey);
      target.addEventListener('click', onClick, true);
      doc.addEventListener('pointerdown', onDocumentDown, true);
      doc.addEventListener('pointermove', onMove, true);
      doc.addEventListener('pointerup', onRelease, true);
      doc.addEventListener('pointercancel', onRelease, true);
      doc.addEventListener('scroll', onAbort, true);
      doc.addEventListener('visibilitychange', onVisibility);
      win?.addEventListener('blur', onAbort);
      return {
        update(config) {
          if (disposed || disabled === config.disabled) return;
          disabled = config.disabled;
          reset();
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          reset();
          target.removeEventListener('pointerdown', onDown);
          target.removeEventListener('contextmenu', onContextMenu);
          target.removeEventListener('keydown', onKey);
          target.removeEventListener('click', onClick, true);
          doc.removeEventListener('pointerdown', onDocumentDown, true);
          doc.removeEventListener('pointermove', onMove, true);
          doc.removeEventListener('pointerup', onRelease, true);
          doc.removeEventListener('pointercancel', onRelease, true);
          doc.removeEventListener('scroll', onAbort, true);
          doc.removeEventListener('visibilitychange', onVisibility);
          win?.removeEventListener('blur', onAbort);
        },
      };
    },
  };
}
