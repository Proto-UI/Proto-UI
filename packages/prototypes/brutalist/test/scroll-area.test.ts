import { afterEach, describe, expect, it } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../src/scroll-area';

AdaptToWebComponent(BrutalistScrollAreaRoot as any);
AdaptToWebComponent(BrutalistScrollAreaViewport as any);
AdaptToWebComponent(BrutalistScrollAreaScrollbar as any);
AdaptToWebComponent(BrutalistScrollAreaThumb as any);

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

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

afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('prototypes/brutalist: scroll-area', () => {
  it('projects the Brutalist visual grammar', async () => {
    const el = document.createElement('brutalist-scroll-area-root') as any;
    document.body.appendChild(el);
    await flush();
    expect(styleContains(el, 'rounded-none')).toBe(true);
    expect(styleContains(el, 'border-2')).toBe(true);

    const thumb = document.createElement('brutalist-scroll-area-thumb') as any;
    document.body.appendChild(thumb);
    await flush();
    expect(styleContains(thumb, 'h-full')).toBe(true);
    expect(styleContains(thumb, 'w-full')).toBe(true);
    // The lavender track does not flip with the theme, so the Thumb takes that
    // accent's paired foreground rather than the theme-global one.
    expect(styleContains(thumb, 'bg-lavender-foreground')).toBe(true);
    expect(styleContains(thumb, 'bg-foreground')).toBe(false);

    const scrollbar = document.createElement('brutalist-scroll-area-scrollbar') as any;
    document.body.appendChild(scrollbar);
    await flush();
    expect(styleContains(scrollbar, 'absolute')).toBe(true);
    expect(styleContains(scrollbar, 'right-0')).toBe(true);
    expect(styleContains(scrollbar, 'top-0')).toBe(true);

    const horizontalScrollbar = document.createElement('brutalist-scroll-area-scrollbar') as any;
    setElementProps(horizontalScrollbar, { orientation: 'horizontal' });
    document.body.appendChild(horizontalScrollbar);
    await flush();
    expect(styleContains(horizontalScrollbar, 'bottom-0')).toBe(true);
    expect(styleContains(horizontalScrollbar, 'left-0')).toBe(true);

    el.remove();
    scrollbar.remove();
    horizontalScrollbar.remove();
    thumb.remove();
  });

  it('projects composed Thumb geometry through the Scroll Area family session', async () => {
    const root = document.createElement('brutalist-scroll-area-root') as any;
    const viewport = document.createElement('brutalist-scroll-area-viewport') as any;
    const scrollbar = document.createElement('brutalist-scroll-area-scrollbar') as any;
    const thumb = document.createElement('brutalist-scroll-area-thumb') as any;
    setMetrics(viewport, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 400,
    });
    Object.defineProperty(scrollbar, 'clientHeight', { configurable: true, value: 100 });
    scrollbar.style.paddingTop = '2px';
    scrollbar.style.paddingBottom = '2px';
    scrollbar.getBoundingClientRect = () =>
      ({ top: 0, left: 0, width: 10, height: 100 }) as DOMRect;
    thumb.getBoundingClientRect = () => ({ top: 2, left: 0, width: 10, height: 24 }) as DOMRect;
    scrollbar.append(thumb);
    root.append(viewport, scrollbar);
    document.body.append(root);
    await flush();

    expect(viewport.dataset.puiScrollProjection).toBe('composed');
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('24px');
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('0px');

    thumb.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientY: 4,
      })
    );
    expect(viewport.scrollTop).toBe(0);
    thumb.dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientY: 40,
      })
    );
    thumb.dispatchEvent(
      new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        pointerId: 7,
        pointerType: 'mouse',
        isPrimary: true,
        button: 0,
        clientY: 40,
      })
    );
    expect(viewport.scrollTop).toBe(150);
    expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('36px');

    expect(thumb.getAttribute('role')).toBeNull();
    expect(thumb.tabIndex).toBe(-1);
  });
});
