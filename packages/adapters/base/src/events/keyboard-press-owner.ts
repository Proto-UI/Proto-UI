type Release = () => void;

export const KEYBOARD_PRESS_OWNER = Symbol.for('@proto.ui/router/keyboard-press-owner');

const windowKeyboardResetUses = new WeakMap<Window, number>();
const resetRoots = new WeakMap<EventListenerOrEventListenerObject, HTMLElement>();

export function clearKeyboardPressOwner(native: Event): void {
  delete (native as Event & { [KEYBOARD_PRESS_OWNER]?: object })[KEYBOARD_PRESS_OWNER];
}

export function markBridgedKeyboardReset(reset: EventListener, root: HTMLElement): void {
  resetRoots.set(reset, root);
}

export function retainBridgedKeyboardReset(
  target: EventTarget,
  listener: EventListenerOrEventListenerObject
): Release | undefined {
  const root = resetRoots.get(listener);
  return root ? retainNativeKeyboardReset(target, root) : undefined;
}

export function retainNativeKeyboardReset(
  target: EventTarget,
  root: HTMLElement
): Release | undefined {
  const view = root.ownerDocument.defaultView;
  if (
    !view ||
    target !== view ||
    view.addEventListener !== view.EventTarget.prototype.addEventListener ||
    view.removeEventListener !== view.EventTarget.prototype.removeEventListener
  )
    return undefined;

  const uses = windowKeyboardResetUses.get(view) ?? 0;
  if (uses === 0) view.addEventListener('keydown', clearKeyboardPressOwner, true);
  windowKeyboardResetUses.set(view, uses + 1);
  return () => {
    const current = windowKeyboardResetUses.get(view) ?? 0;
    if (current > 1) {
      windowKeyboardResetUses.set(view, current - 1);
    } else if (current === 1) {
      windowKeyboardResetUses.delete(view);
      view.removeEventListener('keydown', clearKeyboardPressOwner, true);
    }
  };
}
