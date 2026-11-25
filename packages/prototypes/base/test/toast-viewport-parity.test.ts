import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  toastViewport,
  toastRoot,
  toastTitle,
  toastDescription,
  toastAction,
  toastClose,
} from '../src/toast';

let seq = 0;
const mounted: HTMLElement[] = [];

function registerSet() {
  const prefix = `toast-parity-${++seq}`;
  return {
    Viewport: AdaptToWebComponent(toastViewport, { registerAs: `${prefix}-viewport` }),
    Root: AdaptToWebComponent(toastRoot, { registerAs: `${prefix}-root` }),
    Title: AdaptToWebComponent(toastTitle, { registerAs: `${prefix}-title` }),
    Description: AdaptToWebComponent(toastDescription, { registerAs: `${prefix}-description` }),
    Action: AdaptToWebComponent(toastAction, { registerAs: `${prefix}-action` }),
    Close: AdaptToWebComponent(toastClose, { registerAs: `${prefix}-close` }),
  };
}

async function flush() {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

afterEach(() => {
  vi.useRealTimers();
  for (const el of mounted.splice(0)) el.remove();
});

describe('Base Toast viewport, stacking, semantic type, dismissible, and action parity', () => {
  it('propagates viewport position, expand, pauseAll/resumeAll, and dismissAll to child toasts', async () => {
    const { Viewport, Root, Title } = registerSet();
    const vp = new Viewport();
    const t1 = new Root();
    const t2 = new Root();
    t1.append(new Title());
    t2.append(new Title());
    setElementProps(vp, { position: 'top-center', expand: true });
    setElementProps(t1, { defaultOpen: true, duration: 0 });
    setElementProps(t2, { defaultOpen: true, duration: 0 });
    vp.append(t1, t2);
    document.body.append(vp);
    mounted.push(vp);
    await flush();

    expect(vp.getExposes().position.get()).toBe('top-center');
    expect(vp.getExposes().expanded.get()).toBe(true);
    expect(t1.getExposes().position.get()).toBe('top-center');
    expect(t1.getExposes().expanded.get()).toBe(true);
    expect(t2.getExposes().open.get()).toBe(true);

    vp.getExposes().pauseAll();
    await flush();
    expect(vp.getExposes().paused.get()).toBe(true);
    expect(t1.getExposes().paused.get()).toBe(true);

    vp.getExposes().resumeAll();
    await flush();
    expect(vp.getExposes().paused.get()).toBe(false);
    expect(t1.getExposes().paused.get()).toBe(false);

    vp.getExposes().dismissAll('clear-all');
    await flush();
    expect(t1.getExposes().open.get()).toBe(false);
    expect(t2.getExposes().open.get()).toBe(false);
  });

  it('keeps loading toasts persistent until resolved and upgrades error toasts to assertive alert', async () => {
    vi.useFakeTimers();
    const { Root, Title } = registerSet();
    const loadingToast = new Root();
    loadingToast.append(new Title());
    setElementProps(loadingToast, { defaultOpen: true, type: 'loading' });
    document.body.append(loadingToast);
    mounted.push(loadingToast);
    await flush();

    expect(loadingToast.getExposes().type.get()).toBe('loading');
    expect(loadingToast.getAttribute('role')).toBe('status');
    await vi.advanceTimersByTimeAsync(10000);
    expect(loadingToast.getExposes().open.get()).toBe(true);

    setElementProps(loadingToast, { type: 'error' });
    await flush();
    expect(loadingToast.getExposes().type.get()).toBe('error');
    expect(loadingToast.getAttribute('role')).toBe('alert');
    expect(loadingToast.getAttribute('aria-live')).toBe('assertive');

    await vi.advanceTimersByTimeAsync(5100);
    expect(loadingToast.getExposes().open.get()).toBe(false);
  });

  it('enforces dismissible=false for user-initiated dismiss while allowing programmatic close', async () => {
    const { Root, Close } = registerSet();
    const root = new Root();
    const closeBtn = new Close();
    setElementProps(root, { defaultOpen: true, duration: 0, dismissible: false });
    root.append(closeBtn);
    document.body.append(root);
    mounted.push(root);
    await flush();

    expect(root.getExposes().dismissible.get()).toBe(false);
    closeBtn.click();
    await flush();
    expect(root.getExposes().open.get()).toBe(true);

    root.getExposes().close('escape');
    await flush();
    expect(root.getExposes().open.get()).toBe(true);

    root.getExposes().close('programmatic');
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('respects ToastAction keepOpen=true while keeping default auto-dismiss', async () => {
    const { Root, Action } = registerSet();
    const root = new Root();
    const action = new Action();
    let count = 0;
    action.addEventListener('action', () => {
      count++;
    });
    setElementProps(root, { defaultOpen: true, duration: 0 });
    setElementProps(action, { keepOpen: true });
    root.append(action);
    document.body.append(root);
    mounted.push(root);
    await flush();

    action.click();
    await flush();
    expect(count).toBe(1);
    expect(root.getExposes().open.get()).toBe(true);

    setElementProps(action, { keepOpen: false });
    await flush();
    action.click();
    await flush();
    expect(count).toBe(2);
    expect(root.getExposes().open.get()).toBe(false);
  });

  it('dismisses on swipe in the configured viewport swipeDirection and respects none and dismissible=false', async () => {
    const { Viewport, Root } = registerSet();
    const vp = new Viewport();
    const root = new Root();
    root.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 }) as DOMRect;
    const events: unknown[] = [];
    root.addEventListener('openChange', (event) => events.push((event as CustomEvent).detail));
    setElementProps(vp, { swipeDirection: 'right' });
    setElementProps(root, { defaultOpen: true, duration: 0 });
    vp.append(root);
    document.body.append(vp);
    mounted.push(vp);
    await flush();

    const swipe = (x0: number, y0: number, x1: number, y1: number) => {
      const send = (type: string, clientX: number, clientY: number) =>
        root.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: 'mouse',
            isPrimary: true,
            button: 0,
            clientX,
            clientY,
          })
        );
      send('pointerdown', x0, y0);
      send('pointermove', x1, y1);
      send('pointerup', x1, y1);
    };

    // Opposite or below-threshold drag does not dismiss.
    swipe(100, 50, 10, 50);
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    swipe(100, 50, 140, 50);
    await flush();
    expect(root.getExposes().open.get()).toBe(true);

    // Drag >= 30% in configured direction ('right') dismisses with reason 'swipe'.
    swipe(100, 50, 170, 50);
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
    expect(events).toEqual([{ open: false, reason: 'swipe' }]);

    // Reopen and switch to 'up'.
    root.getExposes().openToast();
    setElementProps(vp, { swipeDirection: 'up' });
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
    swipe(100, 80, 100, 40);
    await flush();
    expect(root.getExposes().open.get()).toBe(false);
    expect(events.at(-1)).toEqual({ open: false, reason: 'swipe' });

    // swipeDirection='none' disables swipe dismissal.
    root.getExposes().openToast();
    setElementProps(vp, { swipeDirection: 'none' });
    await flush();
    swipe(100, 50, 200, 50);
    await flush();
    expect(root.getExposes().open.get()).toBe(true);

    // dismissible=false blocks swipe dismissal even with an active direction.
    setElementProps(vp, { swipeDirection: 'left' });
    setElementProps(root, { dismissible: false });
    await flush();
    swipe(150, 50, 20, 50);
    await flush();
    expect(root.getExposes().open.get()).toBe(true);
  });
});
