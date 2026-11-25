import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { toastAction, toastClose, toastRoot, toastViewport } from '../src/toast';
import type { ToastSwipeDirection } from '../src/toast/types';

const Viewport = AdaptToWebComponent(toastViewport, { registerAs: 'pointer-toast-viewport' });
const Root = AdaptToWebComponent(toastRoot, { registerAs: 'pointer-toast-root' });
const Action = AdaptToWebComponent(toastAction, { registerAs: 'pointer-toast-action' });
const Close = AdaptToWebComponent(toastClose, { registerAs: 'pointer-toast-close' });
const viewport = new Viewport();
const root = new Root();
const action = new Action();
const close = new Close();
let actionCount = 0;
const nativeClicks: Array<{ target: string; trusted: boolean }> = [];
const openChanges: Array<{ open: boolean; reason: string }> = [];

async function settle() {
  for (let turn = 0; turn < 6; turn++) await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

export async function mount() {
  viewport.id = 'viewport';
  root.id = 'toast';
  action.id = 'undo';
  action.textContent = 'Undo';
  close.id = 'dismiss';
  close.textContent = 'Dismiss';
  const copy = document.createElement('p');
  copy.textContent = 'A notification with independent commands.';
  root.append(copy, action, close);
  viewport.append(root);
  setElementProps(viewport, { swipeDirection: 'right' });
  setElementProps(root, { defaultOpen: true, duration: 0 });
  setElementProps(action, { keepOpen: true });
  action.addEventListener('action', () => actionCount++);
  for (const control of [action, close]) {
    control.addEventListener('click', (event) => {
      nativeClicks.push({ target: control.id, trusted: event.isTrusted });
    });
  }
  root.addEventListener('openChange', (event) => {
    openChanges.push((event as CustomEvent<{ open: boolean; reason: string }>).detail);
  });
  document.querySelector('#scrollport')!.prepend(viewport);
  await settle();
}

export function snapshot() {
  return {
    open: root.getExposes().open.get(),
    actionCount,
    nativeClicks: [...nativeClicks],
    openChanges: [...openChanges],
    focused: document.activeElement?.id,
    touchAction: getComputedStyle(root).touchAction,
    scrollTop: document.querySelector('#scrollport')!.scrollTop,
  };
}

export async function reopen() {
  root.getExposes().openToast();
  await settle();
}

export async function direction(swipeDirection: ToastSwipeDirection) {
  setElementProps(viewport, { swipeDirection });
  await settle();
}
