import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
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
});
