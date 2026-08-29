import { afterEach, describe, expect, it, vi } from 'vitest';
import { definePrototype } from '@proto.ui/core';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  asScrollAreaViewport,
  scrollAreaRoot,
  scrollAreaScrollbar,
  scrollAreaThumb,
  scrollAreaViewport,
} from '../src/scroll-area';

AdaptToWebComponent(scrollAreaRoot as any);
AdaptToWebComponent(scrollAreaViewport as any);
AdaptToWebComponent(scrollAreaScrollbar as any);
AdaptToWebComponent(scrollAreaThumb as any);

function setMetrics(
  target: HTMLElement,
  metrics: {
    clientWidth: number;
    scrollWidth: number;
    clientHeight: number;
    scrollHeight: number;
  }
): void {
  Object.defineProperties(target, {
    clientWidth: { configurable: true, value: metrics.clientWidth },
    scrollWidth: { configurable: true, value: metrics.scrollWidth },
    clientHeight: { configurable: true, value: metrics.clientHeight },
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

/** Republishes host geometry the way a content or layout change does. */
function remeasure(viewport: HTMLElement): void {
  viewport.dispatchEvent(new Event('scroll'));
  window.dispatchEvent(new Event('resize'));
}

async function mountViewport(metrics: {
  clientWidth: number;
  scrollWidth: number;
  clientHeight: number;
  scrollHeight: number;
}): Promise<{ root: any; viewport: any }> {
  const root = document.createElement('base-scroll-area-root') as any;
  const viewport = document.createElement('base-scroll-area-viewport') as any;
  setMetrics(viewport, metrics);
  root.append(viewport);
  document.body.append(root);
  await flush();
  return { root, viewport };
}

const OVERFLOWING = { clientWidth: 200, scrollWidth: 500, clientHeight: 100, scrollHeight: 400 };
const FITTING = { clientWidth: 200, scrollWidth: 200, clientHeight: 100, scrollHeight: 100 };

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('prototypes/base: scroll-area', () => {
  it('projects one host-owned Viewport as normalized Base facts', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-VIEWPORT
    const root = document.createElement('base-scroll-area-root') as any;
    const viewport = document.createElement('base-scroll-area-viewport') as any;
    const scrollbar = document.createElement('base-scroll-area-scrollbar') as any;
    const thumb = document.createElement('base-scroll-area-thumb') as any;
    setMetrics(viewport, {
      clientWidth: 200,
      scrollWidth: 500,
      clientHeight: 100,
      scrollHeight: 400,
    });
    scrollbar.append(thumb);
    root.append(viewport, scrollbar);
    document.body.append(root);
    await flush();

    const exposes = viewport.getExposes();
    expect(exposes.scrollAxes.get()).toBe('both');
    expect(exposes.scrollProjection.get()).toBe('system');
    expect(exposes.scrollXPosition.get()).toBe(0);
    expect(exposes.scrollXVisibleRatio.get()).toBe(0.4);
    expect(exposes.canScrollLeft.get()).toBe(false);
    expect(exposes.canScrollRight.get()).toBe(true);
    expect(exposes.scrollYVisibleRatio.get()).toBe(0.25);
    expect(exposes.canScrollUp.get()).toBe(false);
    expect(exposes.canScrollDown.get()).toBe(true);
    expect(viewport.dataset.puiScrollProjection).toBe('system');
    expect(viewport.getAttribute('role')).toBeNull();
  });

  it('keeps Scrollbar orientation in the control part without creating Thumb behavior', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-CONTROLS
    const root = document.createElement('base-scroll-area-root') as any;
    const viewport = document.createElement('base-scroll-area-viewport') as any;
    const scrollbar = document.createElement('base-scroll-area-scrollbar') as any;
    const thumb = document.createElement('base-scroll-area-thumb') as any;
    scrollbar.append(thumb);
    root.append(viewport, scrollbar);
    document.body.append(root);
    await flush();

    expect(scrollbar.getExposes().orientation.get()).toBe('vertical');
    setElementProps(scrollbar, { orientation: 'horizontal' });
    await flush();
    expect(scrollbar.getExposes().orientation.get()).toBe('horizontal');
    expect(thumb.getExposes()).toEqual({});
    expect(thumb.tabIndex).toBe(-1);
    expect(thumb.getAttribute('role')).toBeNull();
  });
  it('gives a scrolling Viewport keyboard focus facts without a widget role', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-VIEWPORT-FOCUS
    const { viewport } = await mountViewport(OVERFLOWING);

    const exposes = viewport.getExposes();
    expect(exposes.focused.get()).toBe(false);
    expect(exposes.focusVisible.get()).toBe(false);
    // Sequential navigation reaches a surface that has somewhere to scroll.
    expect(viewport.getAttribute('tabindex')).toBe('0');
    // Being reachable is not a reason to invent a widget role.
    expect(viewport.getAttribute('role')).toBeNull();
    // `focusable` in the Focus module means something other than "can scroll",
    // so the Viewport must not publish it as this fact.
    expect(Object.keys(exposes)).not.toContain('focusable');
  });

  it('hands a styled projection the focus facts instead of a focus domain', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-VIEWPORT-FOCUS
    let handles: Record<string, unknown> = {};
    const styled = definePrototype({
      name: 'test-styled-scroll-area-viewport',
      setup() {
        handles = (asScrollAreaViewport() as any).stateHandles ?? {};
      },
    });
    AdaptToWebComponent(styled as any);

    const root = document.createElement('base-scroll-area-root') as any;
    const viewport = document.createElement('test-styled-scroll-area-viewport') as any;
    setMetrics(viewport, OVERFLOWING);
    root.append(viewport);
    document.body.append(root);
    await flush();

    // Reading these is what lets a projection paint a ring without installing a
    // second focus domain of its own.
    expect(typeof (handles.focused as any)?.get).toBe('function');
    expect(typeof (handles.focusVisible as any)?.get).toBe('function');
    expect(viewport.getAttribute('tabindex')).toBe('0');
  });

  it('keeps a Viewport with nothing to scroll out of sequential navigation', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-VIEWPORT-FOCUS
    const { viewport } = await mountViewport(FITTING);

    expect(viewport.getExposes().canScrollDown.get()).toBe(false);
    expect(viewport.getExposes().canScrollRight.get()).toBe(false);
    // An empty tab stop is worse than no tab stop.
    expect(viewport.getAttribute('tabindex')).toBe('-1');
    // The facts still exist, so a projection can read them either way.
    expect(viewport.getExposes().focused.get()).toBe(false);
  });

  it('follows content between scrollable and not', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-VIEWPORT-FOCUS
    const { viewport } = await mountViewport(FITTING);
    expect(viewport.getAttribute('tabindex')).toBe('-1');

    setMetrics(viewport, OVERFLOWING);
    remeasure(viewport);
    await flush();
    expect(viewport.getExposes().canScrollDown.get()).toBe(true);
    expect(viewport.getAttribute('tabindex')).toBe('0');

    setMetrics(viewport, FITTING);
    remeasure(viewport);
    await flush();
    expect(viewport.getExposes().canScrollDown.get()).toBe(false);
    expect(viewport.getAttribute('tabindex')).toBe('-1');
  });

  it('leaves focus where it is when the last scrollable direction goes away', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-VIEWPORT-FOCUS
    const { viewport } = await mountViewport(OVERFLOWING);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(viewport, 'matches').mockReturnValue(true);
    viewport.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(viewport.getExposes().focused.get()).toBe(true);

    setMetrics(viewport, FITTING);
    remeasure(viewport);
    await flush();

    // Only what sequential navigation reaches next may change.
    expect(viewport.getAttribute('tabindex')).toBe('-1');
    expect(viewport.getExposes().focused.get()).toBe(true);
  });

  it('separates keyboard entry from pointer entry', async () => {
    // T-BASE-SCROLL-AREA-0001-CASE-VIEWPORT-FOCUS
    const { viewport } = await mountViewport(OVERFLOWING);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(viewport, 'matches').mockReturnValue(true);
    viewport.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(viewport.getExposes().focused.get()).toBe(true);
    expect(viewport.getExposes().focusVisible.get()).toBe(true);

    viewport.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
    matchesSpy.mockRestore();
    viewport.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    viewport.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();
    expect(viewport.getExposes().focused.get()).toBe(true);
    expect(viewport.getExposes().focusVisible.get()).toBe(false);
  });
});
