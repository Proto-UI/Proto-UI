import { afterEach, describe, expect, expectTypeOf, it } from 'vitest';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import {
  SCROLL_SURFACE_HOST_CAP,
  type ScrollPort,
  type ScrollSurfaceHost,
  type ScrollSurfaceHostAttachment,
} from '@proto.ui/module-scroll';
import { createRuntimeSession, type RuntimeHost } from '@proto.ui/runtime';
import { styleContains } from '../../test-utils/style';
import * as ShadcnPackage from '../src';
import * as scrollAreaFamily from '../src/scroll-area';
import type {
  ShadcnScrollAreaRootProps,
  ShadcnScrollAreaScrollbarProps,
  ShadcnScrollAreaThumbProps,
  ShadcnScrollAreaViewportProps,
} from '../src/scroll-area';

type HasUnsupportedRootApi =
  Extract<
    'asChild' | 'type' | 'dir' | 'scrollbarSize' | 'onScrollPositionChange',
    keyof ShadcnScrollAreaRootProps
  > extends never
    ? false
    : true;
type HasUnsupportedViewportApi =
  Extract<
    'asChild' | 'type' | 'dir' | 'scrollbarSize' | 'onScrollPositionChange',
    keyof ShadcnScrollAreaViewportProps
  > extends never
    ? false
    : true;
type HasUnsupportedScrollbarApi =
  Extract<'forceMount' | 'scrollbarSize', keyof ShadcnScrollAreaScrollbarProps> extends never
    ? false
    : true;
type HasUnsupportedThumbApi =
  Extract<'forceMount' | 'scrollbarSize', keyof ShadcnScrollAreaThumbProps> extends never
    ? false
    : true;

const {
  ShadcnScrollAreaRoot,
  ShadcnScrollAreaScrollbar,
  ShadcnScrollAreaThumb,
  ShadcnScrollAreaViewport,
} = scrollAreaFamily;

const ScrollAreaRootElement = AdaptToWebComponent(ShadcnScrollAreaRoot);
const ScrollAreaViewportElement = AdaptToWebComponent(ShadcnScrollAreaViewport);
const ScrollAreaScrollbarElement = AdaptToWebComponent(ShadcnScrollAreaScrollbar);
const ScrollAreaThumbElement = AdaptToWebComponent(ShadcnScrollAreaThumb);

function setMetrics(
  target: HTMLElement,
  metrics: { clientWidth: number; scrollWidth: number; clientHeight: number; scrollHeight: number }
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

async function settle(): Promise<void> {
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let index = 0; index < 4; index += 1) await Promise.resolve();
}

function exportedPrototypeName(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('name' in value)) return null;
  return typeof value.name === 'string' ? value.name : null;
}

afterEach(async () => {
  document.body.replaceChildren();
  await settle();
});

describe('prototypes/shadcn: scroll-area', () => {
  it('exports exactly Root, Viewport, Scrollbar, and Thumb without host-specific APIs', () => {
    expect(
      Object.fromEntries(
        Object.entries(scrollAreaFamily).map(([name, value]) => [
          name,
          exportedPrototypeName(value),
        ])
      )
    ).toEqual({
      ShadcnScrollAreaRoot: 'shadcn-scroll-area-root',
      ShadcnScrollAreaScrollbar: 'shadcn-scroll-area-scrollbar',
      ShadcnScrollAreaThumb: 'shadcn-scroll-area-thumb',
      ShadcnScrollAreaViewport: 'shadcn-scroll-area-viewport',
      shadcnScrollAreaRoot: 'shadcn-scroll-area-root',
      shadcnScrollAreaScrollbar: 'shadcn-scroll-area-scrollbar',
      shadcnScrollAreaThumb: 'shadcn-scroll-area-thumb',
      shadcnScrollAreaViewport: 'shadcn-scroll-area-viewport',
    });
    expect(
      Object.fromEntries(
        Object.entries(ShadcnPackage)
          .filter(([name]) => name.toLowerCase().includes('scrollarea'))
          .map(([name, value]) => [name, exportedPrototypeName(value)])
      )
    ).toEqual({
      ShadcnScrollAreaRoot: 'shadcn-scroll-area-root',
      ShadcnScrollAreaScrollbar: 'shadcn-scroll-area-scrollbar',
      ShadcnScrollAreaThumb: 'shadcn-scroll-area-thumb',
      ShadcnScrollAreaViewport: 'shadcn-scroll-area-viewport',
      shadcnScrollAreaRoot: 'shadcn-scroll-area-root',
      shadcnScrollAreaScrollbar: 'shadcn-scroll-area-scrollbar',
      shadcnScrollAreaThumb: 'shadcn-scroll-area-thumb',
      shadcnScrollAreaViewport: 'shadcn-scroll-area-viewport',
    });
    expectTypeOf<HasUnsupportedRootApi>().toEqualTypeOf<false>();
    expectTypeOf<HasUnsupportedViewportApi>().toEqualTypeOf<false>();
    expectTypeOf<HasUnsupportedScrollbarApi>().toEqualTypeOf<false>();
    expectTypeOf<HasUnsupportedThumbApi>().toEqualTypeOf<false>();
  });

  it('projects every governed surface and orientation-specific track geometry', async () => {
    const root = new ScrollAreaRootElement();
    const viewport = new ScrollAreaViewportElement();
    const vertical = new ScrollAreaScrollbarElement();
    const horizontal = new ScrollAreaScrollbarElement();
    const verticalThumb = new ScrollAreaThumbElement();
    const horizontalThumb = new ScrollAreaThumbElement();
    setElementProps(horizontal, { orientation: 'horizontal' });
    setMetrics(viewport, {
      clientWidth: 100,
      scrollWidth: 400,
      clientHeight: 100,
      scrollHeight: 400,
    });
    vertical.append(verticalThumb);
    horizontal.append(horizontalThumb);
    root.append(viewport, vertical, horizontal);
    document.body.append(root);
    await settle();

    for (const token of ['relative', 'overflow-hidden']) {
      expect(styleContains(root, token), `root/${token}`).toBe(true);
    }
    for (const token of [
      'h-full',
      'w-full',
      'rounded-md',
      'transition-[color,box-shadow]',
      'outline-none',
    ]) {
      expect(styleContains(viewport, token), `viewport/${token}`).toBe(true);
    }
    for (const token of [
      'data-[focus-visible]:ring-3',
      'data-[focus-visible]:ring-ring/50',
      'data-[focus-visible]:ring-inset',
      'data-[focus-visible]:outline-1',
      'data-[focus-visible]:outline-ring',
    ]) {
      expect(styleContains(viewport, token), `viewport/${token}`).toBe(true);
    }
    for (const token of ['flex', 'touch-none', 'select-none', 'transition-colors', 'absolute']) {
      expect(styleContains(vertical, token), `vertical/common/${token}`).toBe(true);
      expect(styleContains(horizontal, token), `horizontal/common/${token}`).toBe(true);
    }
    for (const token of ['h-full', 'w-2.5', 'top-0', 'right-0', 'border-2', 'border-transparent']) {
      const projected = `data-[orientation=vertical]:${token}`;
      expect(styleContains(vertical, projected), projected).toBe(true);
    }
    for (const token of [
      'w-full',
      'h-2.5',
      'flex-col',
      'bottom-0',
      'left-0',
      'border-2',
      'border-transparent',
    ]) {
      const projected = `data-[orientation=horizontal]:${token}`;
      expect(styleContains(horizontal, projected), projected).toBe(true);
    }
    for (const thumb of [verticalThumb, horizontalThumb]) {
      for (const token of ['relative', 'flex-1', 'rounded-full', 'bg-border']) {
        expect(styleContains(thumb, token), `thumb/${token}`).toBe(true);
      }
      expect(thumb.getAttribute('role')).toBeNull();
      expect(thumb.tabIndex).toBe(-1);
    }
    expect(viewport.dataset.puiScrollProjection).toBe('composed');
    expect(viewport.getExposes().scrollProjection.get()).toBe('composed');
  });

  it('falls back to system without a diagnostic when the host cannot compose chrome', async () => {
    // T-SHADCN-SCROLL-AREA-0001-CASE-COMPOSED-PREFERENCE
    const instance = new EventTarget();
    const attachments: ScrollSurfaceHostAttachment[] = [];
    const scrollHost: ScrollSurfaceHost = {
      support: { system: true, composed: false },
      attach(connection) {
        attachments.push(connection);
        return {
          update(next) {
            attachments.push(next);
          },
          request() {},
          dispose() {},
        };
      },
    };
    const host: RuntimeHost<any> = {
      prototypeName: 'shadcn-scroll-area-system-fallback',
      getRawProps: () => ({}),
      commit(_children, signal) {
        signal?.done();
      },
      schedule(task) {
        task();
      },
      onRuntimeReady(wiring) {
        wiring.attach('anatomy', [
          [ANATOMY_INSTANCE_TOKEN_CAP, instance],
          [ANATOMY_PARENT_CAP, () => null],
          [ANATOMY_GET_PROTO_CAP, () => ShadcnScrollAreaViewport],
          [ANATOMY_ROOT_TARGET_CAP, () => instance],
        ]);
        wiring.attach('context', [
          [CONTEXT_INSTANCE_TOKEN_CAP, instance],
          [CONTEXT_PARENT_CAP, () => null],
        ]);
        wiring.attach('event', [
          [EVENT_ROOT_TARGET_CAP, () => instance],
          [EVENT_GLOBAL_TARGET_CAP, () => instance],
        ]);
        wiring.attach('scroll', [[SCROLL_SURFACE_HOST_CAP, scrollHost]]);
      },
    };
    const session = createRuntimeSession(ShadcnScrollAreaViewport, host);

    try {
      await expect(session.mount()).resolves.toBeUndefined();
      expect(attachments).toHaveLength(1);
      expect(attachments[0]?.config.requireProjection).toBeUndefined();
      expect(attachments[0]?.projection).toBe('system');
      expect(session.caps.getPort<ScrollPort>('scroll')?.getSnapshot().projection).toBe('system');
    } finally {
      await session.dispose();
    }
  });

  it('inherits two-axis host scrolling, guarded Thumb movement, replacement, and teardown', async () => {
    const root = new ScrollAreaRootElement();
    const viewport = new ScrollAreaViewportElement();
    const vertical = new ScrollAreaScrollbarElement();
    const horizontal = new ScrollAreaScrollbarElement();
    const verticalThumb = new ScrollAreaThumbElement();
    const horizontalThumb = new ScrollAreaThumbElement();
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

    expect(viewport.getAttribute('tabindex')).toBe('0');
    expect(viewport.getAttribute('role')).toBeNull();
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
    const replacementThumb = new ScrollAreaThumbElement();
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
