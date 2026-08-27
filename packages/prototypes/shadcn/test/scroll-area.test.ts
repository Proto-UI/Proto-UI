import { afterEach, describe, expect, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { styleContains } from '../../test-utils/style';
import {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaViewport,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
} from '../src/scroll-area';

AdaptToWebComponent(ShadcnScrollAreaRoot);
AdaptToWebComponent(ShadcnScrollAreaViewport);
AdaptToWebComponent(ShadcnScrollAreaScrollbar);
AdaptToWebComponent(ShadcnScrollAreaThumb);
async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await Promise.resolve();
}
async function settle(): Promise<void> {
  await flush();
  await new Promise((r) => setTimeout(r, 0));
  await flush();
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

function pointer(type: string, overrides: Partial<PointerEventInit> = {}): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    ...overrides,
  });
}
afterEach(async () => {
  document.body.replaceChildren();
  await flush();
});

describe('prototypes/shadcn: scroll-area', () => {
  it('renders root, viewport, scrollbar, thumb with correct entry names and visual grammar', async () => {
    expect(ShadcnScrollAreaRoot.name).toBe('shadcn-scroll-area-root');
    expect(ShadcnScrollAreaViewport.name).toBe('shadcn-scroll-area-viewport');
    expect(ShadcnScrollAreaScrollbar.name).toBe('shadcn-scroll-area-scrollbar');
    expect(ShadcnScrollAreaThumb.name).toBe('shadcn-scroll-area-thumb');

    const root = document.createElement(ShadcnScrollAreaRoot.name) as any;
    const viewport = document.createElement(ShadcnScrollAreaViewport.name) as any;
    const scrollbar = document.createElement(ShadcnScrollAreaScrollbar.name) as any;
    const thumb = document.createElement(ShadcnScrollAreaThumb.name) as any;
    root.appendChild(viewport);
    root.appendChild(scrollbar);
    scrollbar.appendChild(thumb);
    document.body.appendChild(root);
    await settle();

    expect(styleContains(root, 'relative')).toBe(true);
    expect(styleContains(root, 'overflow-hidden')).toBe(true);
    expect(styleContains(viewport, 'h-full')).toBe(true);
    expect(styleContains(viewport, 'w-full')).toBe(true);
    expect(styleContains(scrollbar, 'absolute')).toBe(true);
    expect(styleContains(scrollbar, 'flex')).toBe(true);
    expect(styleContains(thumb, 'rounded-full')).toBe(true);
    expect(styleContains(thumb, 'bg-border')).toBe(true);
  });

  it('inherits two-axis composed drag, guard, replacement, no-overflow, and teardown behavior', async () => {
    const root = document.createElement(ShadcnScrollAreaRoot.name) as any;
    const viewport = document.createElement(ShadcnScrollAreaViewport.name) as any;
    const vertical = document.createElement(ShadcnScrollAreaScrollbar.name) as any;
    const horizontal = document.createElement(ShadcnScrollAreaScrollbar.name) as any;
    const verticalThumb = document.createElement(ShadcnScrollAreaThumb.name) as any;
    const horizontalThumb = document.createElement(ShadcnScrollAreaThumb.name) as any;
    setElementProps(horizontal, { orientation: 'horizontal' });
    setMetrics(viewport, {
      clientWidth: 100,
      scrollWidth: 400,
      clientHeight: 100,
      scrollHeight: 400,
    });
    Object.defineProperties(vertical, {
      clientHeight: { configurable: true, value: 100 },
      clientWidth: { configurable: true, value: 10 },
    });
    Object.defineProperties(horizontal, {
      clientHeight: { configurable: true, value: 10 },
      clientWidth: { configurable: true, value: 100 },
    });
    vertical.getBoundingClientRect = () =>
      ({ top: 0, left: 90, width: 10, height: 100 }) as DOMRect;
    horizontal.getBoundingClientRect = () =>
      ({ top: 90, left: 0, width: 100, height: 10 }) as DOMRect;
    verticalThumb.getBoundingClientRect = () =>
      ({ top: 0, left: 90, width: 10, height: 25 }) as DOMRect;
    horizontalThumb.getBoundingClientRect = () =>
      ({ top: 90, left: 0, width: 25, height: 10 }) as DOMRect;
    vertical.append(verticalThumb);
    horizontal.append(horizontalThumb);
    root.append(viewport, vertical, horizontal);
    document.body.append(root);
    await settle();

    expect(viewport.dataset.puiScrollProjection).toBe('composed');
    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(viewport.getAttribute('role')).toBeNull();
    expect(verticalThumb.getAttribute('role')).toBeNull();
    expect(verticalThumb.tabIndex).toBe(-1);
    expect(verticalThumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('25px');
    expect(horizontalThumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('25px');

    verticalThumb.dispatchEvent(pointer('pointerdown', { isPrimary: false, clientY: 5 }));
    verticalThumb.dispatchEvent(pointer('pointermove', { isPrimary: false, clientY: 45 }));
    expect(viewport.scrollTop).toBe(0);

    verticalThumb.dispatchEvent(pointer('pointerdown', { clientY: 5 }));
    verticalThumb.dispatchEvent(pointer('pointermove', { pointerId: 8, clientY: 45 }));
    expect(viewport.scrollTop).toBe(0);
    verticalThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    verticalThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(viewport.scrollTop).toBeGreaterThan(0);

    horizontalThumb.dispatchEvent(pointer('pointerdown', { clientX: 5 }));
    horizontalThumb.dispatchEvent(pointer('pointermove', { clientX: 45 }));
    horizontalThumb.dispatchEvent(pointer('pointerup', { clientX: 45 }));
    expect(viewport.scrollLeft).toBeGreaterThan(0);

    Object.defineProperties(viewport, {
      scrollLeft: { configurable: true, value: 0, writable: true },
      scrollTop: { configurable: true, value: 0, writable: true },
    });
    const replacementThumb = document.createElement(ShadcnScrollAreaThumb.name) as any;
    replacementThumb.getBoundingClientRect = () =>
      ({ top: 0, left: 90, width: 10, height: 25 }) as DOMRect;
    verticalThumb.replaceWith(replacementThumb);
    await settle();

    verticalThumb.dispatchEvent(pointer('pointerdown', { clientY: 5 }));
    verticalThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    verticalThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(viewport.scrollTop).toBe(0);
    replacementThumb.dispatchEvent(pointer('pointerdown', { clientY: 5 }));
    replacementThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    replacementThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(viewport.scrollTop).toBeGreaterThan(0);

    setMetrics(viewport, {
      clientWidth: 100,
      scrollWidth: 100,
      clientHeight: 100,
      scrollHeight: 100,
    });
    viewport.dispatchEvent(new Event('scroll'));
    window.dispatchEvent(new Event('resize'));
    await settle();
    expect(viewport.getAttribute('tabindex')).toBe('-1');
    replacementThumb.dispatchEvent(pointer('pointerdown', { clientY: 5 }));
    replacementThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    replacementThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    expect(viewport.scrollTop).toBe(0);

    root.remove();
    await settle();
    replacementThumb.dispatchEvent(pointer('pointerdown', { clientY: 5 }));
    replacementThumb.dispatchEvent(pointer('pointermove', { clientY: 45 }));
    replacementThumb.dispatchEvent(pointer('pointerup', { clientY: 45 }));
    window.dispatchEvent(new Event('resize'));
    expect(viewport.scrollTop).toBe(0);
  });
});
