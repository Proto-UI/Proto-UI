import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { SHADCN_STYLE_TOKENS } from '../../../cli/src/generated/shadcn-style-tokens';
import { renderProtoStyleTokenCss } from '../../../cli/src/services/proto-style-css';
import { unwrapGeneratedTokenLayer } from '../../../../scripts/release/consumer-smoke-css.mjs';
import { toastRoot, toastViewport } from '../src/toast';

const Viewport = AdaptToWebComponent(toastViewport, { registerAs: 'toast-presence-viewport' });
const Root = AdaptToWebComponent(toastRoot, { registerAs: 'toast-presence-root' });
const owned: HTMLElement[] = [];
const flush = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
  const stylesheet = document.createElement('style');
  // Happy DOM has no cascade layers. Keep the shipped selectors/declarations
  // while unwrapping their layer, as in the existing CSS consumer tests.
  stylesheet.textContent = unwrapGeneratedTokenLayer(renderProtoStyleTokenCss(SHADCN_STYLE_TOKENS));
  document.head.append(stylesheet);
  owned.push(stylesheet);
});

afterEach(async () => {
  for (const node of owned.splice(0).reverse()) node.remove();
  await flush();
  vi.useRealTimers();
});

describe('Shadcn Toast retained leaving presentation', () => {
  for (const controlled of [false, true]) {
    it(`${controlled ? 'controlled' : 'uncontrolled'}: leaves the open stack flow while remaining present for 500ms and can reopen`, async () => {
      const viewport = new Viewport();
      const root = new Root();
      const props = {
        duration: 0,
        leaveDuration: 500,
        ...(controlled ? { open: true } : {}),
      };
      setElementProps(root, props);
      root.textContent = 'Saved notification';
      viewport.append(root);
      document.body.append(viewport);
      owned.push(viewport);
      await flush();

      const api = root.getExposes();
      const presentationOwner = api.getPresentationOwner();
      expect(api.open.get()).toBe(true);
      expect(api.transitionState.get()).toBe('entered');
      expect(getComputedStyle(root).position).toBe('relative');
      expect(getComputedStyle(root).width).toBe('100%');
      expect(getComputedStyle(root).display).toBe('flex');
      expect(getComputedStyle(root).pointerEvents).toBe('auto');

      if (controlled) setElementProps(root, { ...props, open: false });
      else api.close();
      await flush();

      expect(api.open.get()).toBe(false);
      expect(api.stackIndex.get()).toBe(-1);
      expect(api.transitionState.get()).toBe('leaving');
      expect(api.isPresent.get()).toBe(true);
      // An outgoing view must not reserve the next notification's anchor or
      // intercept input while its nonzero leave interval completes.
      expect(getComputedStyle(root).position).toBe('absolute');
      expect(getComputedStyle(root).zIndex).toBe('0');
      expect(getComputedStyle(root).pointerEvents).toBe('none');
      expect(getComputedStyle(root).width).toBe('100%');
      expect(getComputedStyle(root).display).toBe('flex');
      expect(getComputedStyle(root).opacity).toBe('1');

      await vi.advanceTimersByTimeAsync(499);
      expect(api.transitionState.get()).toBe('leaving');
      expect(api.isPresent.get()).toBe(true);
      expect(getComputedStyle(root).position).toBe('absolute');
      expect(getComputedStyle(root).zIndex).toBe('0');
      expect(getComputedStyle(root).pointerEvents).toBe('none');
      await vi.advanceTimersByTimeAsync(1);
      await flush();
      expect(api.transitionState.get()).toBe('closed');
      expect(api.isPresent.get()).toBe(false);
      expect(getComputedStyle(root).display).toBe('none');

      if (controlled) setElementProps(root, { ...props, open: true });
      else api.openToast();
      await flush();
      await vi.advanceTimersByTimeAsync(0);
      expect(api.getPresentationOwner()).toBe(presentationOwner);
      expect(api.open.get()).toBe(true);
      expect(api.transitionState.get()).toBe('entered');
      expect(api.stackIndex.get()).toBe(0);
      expect(getComputedStyle(root).position).toBe('relative');
      expect(getComputedStyle(root).width).toBe('100%');
      expect(getComputedStyle(root).display).toBe('flex');
      expect(getComputedStyle(root).pointerEvents).toBe('auto');
    });
  }

  it('T-TOAST-STACK-0001-CASE-HOVER-STABILITY: switches viewport pointer-events only while expanded with open toasts and clears hover when stack empties', async () => {
    const viewport = new Viewport();
    const first = new Root();
    const second = new Root();
    setElementProps(viewport, { position: 'bottom-right', duration: 0 });
    setElementProps(first, { defaultOpen: false, duration: 0 });
    setElementProps(second, { defaultOpen: false, duration: 0 });
    first.textContent = 'First toast';
    second.textContent = 'Second toast';
    viewport.append(first, second);
    document.body.append(viewport);
    owned.push(viewport);
    await flush();

    const vp = viewport.getExposes();
    expect(vp.hasOpen.get()).toBe(false);
    expect(vp.expanded.get()).toBe(false);
    expect(getComputedStyle(viewport).pointerEvents).toBe('none');

    // Empty viewport must not enter hovered/expanded state on stray pointerenter.
    viewport.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
    await flush();
    expect(vp.expanded.get()).toBe(false);
    expect(getComputedStyle(viewport).pointerEvents).toBe('none');

    // Open two toasts: collapsed viewport stays click-through while cards receive hits.
    first.getExposes().openToast();
    second.getExposes().openToast();
    await flush();
    expect(vp.hasOpen.get()).toBe(true);
    expect(vp.expanded.get()).toBe(false);
    expect(getComputedStyle(viewport).pointerEvents).toBe('none');
    expect(getComputedStyle(second).pointerEvents).toBe('auto');

    // Hovering expands the stack and activates viewport pointer-events so inter-card gaps stay hovered.
    viewport.dispatchEvent(new PointerEvent('pointerenter', { bubbles: false }));
    await flush();
    expect(vp.expanded.get()).toBe(true);
    expect(vp.paused.get()).toBe(true);
    expect(getComputedStyle(viewport).pointerEvents).toBe('auto');

    // Closing all toasts while hovered resets hover, expanded, and pointer-events-none.
    first.getExposes().close('programmatic');
    second.getExposes().close('programmatic');
    await flush();
    expect(vp.hasOpen.get()).toBe(false);
    expect(vp.expanded.get()).toBe(false);
    expect(vp.paused.get()).toBe(false);
    expect(getComputedStyle(viewport).pointerEvents).toBe('none');
  });
});
