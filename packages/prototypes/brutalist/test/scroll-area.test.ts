import { afterEach, describe, expect, it, vi } from 'vitest';
import { styleContains } from '../../test-utils/style';
import { AdaptToWebComponent, setElementProps } from '@proto.ui/adapter-web-component';
import { executeWithHost, type RuntimeHost } from '@proto.ui/runtime';
import {
  ANATOMY_GET_PROTO_CAP,
  ANATOMY_INSTANCE_TOKEN_CAP,
  ANATOMY_PARENT_CAP,
  ANATOMY_ROOT_TARGET_CAP,
} from '@proto.ui/module-anatomy';
import { CONTEXT_INSTANCE_TOKEN_CAP, CONTEXT_PARENT_CAP } from '@proto.ui/module-context';
import { EVENT_GLOBAL_TARGET_CAP, EVENT_ROOT_TARGET_CAP } from '@proto.ui/module-event';
import { FOCUS_ROOT_TARGET_CAP, FOCUS_SET_FOCUSABLE_CAP } from '@proto.ui/module-focus';
import {
  BrutalistScrollAreaRoot,
  BrutalistScrollAreaViewport,
  BrutalistScrollAreaScrollbar,
  BrutalistScrollAreaThumb,
} from '../src/scroll-area';

type HookedPrototype = {
  name: string;
  __asHooks?: ReadonlyArray<{ name: string; mode?: string }>;
};

function expectSingleAsHook(prototype: HookedPrototype, hookName: string): void {
  const matchingHooks = (prototype.__asHooks ?? []).filter((hook) => hook.name === hookName);
  expect(matchingHooks, `${prototype.name} must inherit ${hookName} exactly once`).toEqual([
    expect.objectContaining({ name: hookName, mode: 'once' }),
  ]);
}

function executeForHookTrace(prototype: HookedPrototype): () => void | Promise<void> {
  const instance = new EventTarget();
  const globalTarget = new EventTarget();
  const host: RuntimeHost<any> = {
    prototypeName: `${prototype.name}-hook-trace`,
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
        [ANATOMY_GET_PROTO_CAP, () => prototype],
        [ANATOMY_ROOT_TARGET_CAP, () => instance],
      ]);
      wiring.attach('context', [
        [CONTEXT_INSTANCE_TOKEN_CAP, instance],
        [CONTEXT_PARENT_CAP, () => null],
      ]);
      wiring.attach('event', [
        [EVENT_ROOT_TARGET_CAP, () => instance],
        [EVENT_GLOBAL_TARGET_CAP, () => globalTarget],
      ]);
      wiring.attach('focus', [
        [FOCUS_ROOT_TARGET_CAP, () => instance],
        [FOCUS_SET_FOCUSABLE_CAP, () => undefined],
      ]);
    },
  };
  const { invokeUnmounted } = executeWithHost(prototype as any, host);
  return invokeUnmounted;
}

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
  it('inherits every Base Scroll Area anatomy hook exactly once', async () => {
    // T-BRUTALIST-SCROLL-AREA-0001-CASE-BASE-INHERITANCE
    const prototypes = [
      BrutalistScrollAreaRoot,
      BrutalistScrollAreaScrollbar,
      BrutalistScrollAreaThumb,
      BrutalistScrollAreaViewport,
    ] as HookedPrototype[];
    const unmount = prototypes.map(executeForHookTrace);

    try {
      expectSingleAsHook(BrutalistScrollAreaRoot as HookedPrototype, 'as-scroll-area-root');
      expectSingleAsHook(
        BrutalistScrollAreaScrollbar as HookedPrototype,
        'as-scroll-area-scrollbar'
      );
      expectSingleAsHook(BrutalistScrollAreaThumb as HookedPrototype, 'as-scroll-area-thumb');
      expectSingleAsHook(BrutalistScrollAreaViewport as HookedPrototype, 'as-scroll-area-viewport');
    } finally {
      await Promise.all(unmount.map((dispose) => dispose()));
    }
  });

  it('projects the Brutalist visual grammar', async () => {
    const el = document.createElement('brutalist-scroll-area-root') as any;
    document.body.appendChild(el);
    await flush();
    expect(styleContains(el, 'rounded-none')).toBe(true);
    expect(styleContains(el, 'border-2')).toBe(true);
    expect(styleContains(el, 'block')).toBe(true);
    expect(styleContains(el, 'border-foreground')).toBe(true);
    expect(styleContains(el, 'bg-background')).toBe(true);

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

  it('requests the composed Viewport projection through the host', async () => {
    // T-BRUTALIST-SCROLL-AREA-0001-CASE-COMPOSED-PREFERENCE
    const root = document.createElement(BrutalistScrollAreaRoot.name) as any;
    const viewport = document.createElement(BrutalistScrollAreaViewport.name) as any;
    root.appendChild(viewport);
    document.body.appendChild(root);
    await flush();

    // This is the host-resolved outcome of the privileged design-language
    // preference, not a claim that Web DOM owns the portable scroll protocol.
    expect(viewport.dataset.puiScrollProjection).toBe('composed');
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
  it('rings the focused Viewport inside its own box', async () => {
    // T-BRUTALIST-SCROLL-AREA-0001-CASE-VIEWPORT-FOCUS
    const root = document.createElement('brutalist-scroll-area-root') as any;
    const viewport = document.createElement('brutalist-scroll-area-viewport') as any;
    setMetrics(viewport, {
      clientWidth: 200,
      scrollWidth: 200,
      clientHeight: 100,
      scrollHeight: 400,
    });
    root.append(viewport);
    document.body.append(root);
    await flush();

    // The Root clips outward drawing, so the ring has to be inset.
    for (const token of [
      'data-[focus-visible]:ring-2',
      'data-[focus-visible]:ring-ring',
      'data-[focus-visible]:ring-inset',
      'data-[focus-visible]:ring-offset-0',
    ]) {
      expect(
        styleContains(viewport, token),
        `${token} :: ${viewport.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    // The shared Brutalist focus tokens draw outward and would be clipped.
    expect(styleContains(viewport, 'data-[focus-visible]:ring-offset-2')).toBe(false);
    // At rest the box carries no ring.
    expect(viewport.hasAttribute('data-focus-visible')).toBe(false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const matchesSpy = vi.spyOn(viewport, 'matches').mockReturnValue(true);
    viewport.dispatchEvent(new FocusEvent('focus', { bubbles: true }));
    await flush();

    // The fact comes from Base; this layer only paints from it.
    expect(viewport.hasAttribute('data-focus-visible')).toBe(true);
    expect(viewport.getExposes().focusVisible.get()).toBe(true);
    matchesSpy.mockRestore();
  });

  it('scrollbar projects the complete track and orientation surfaces', async () => {
    const root = document.createElement(BrutalistScrollAreaRoot.name) as any;
    const vertical = document.createElement(BrutalistScrollAreaScrollbar.name) as any;
    const horizontal = document.createElement(BrutalistScrollAreaScrollbar.name) as any;
    setElementProps(horizontal, { orientation: 'horizontal' });
    root.append(vertical, horizontal);
    document.body.appendChild(root);
    await flush();

    for (const scrollbar of [vertical, horizontal]) {
      for (const token of ['flex', 'select-none', 'touch-none', 'bg-lavender', 'p-0.5']) {
        expect(
          styleContains(scrollbar, token),
          `${token} :: ${scrollbar.getAttribute('data-pui-style')}`
        ).toBe(true);
      }
      const tokens = String(scrollbar.getAttribute('data-pui-style') ?? '').split(/\s+/);
      const prohibitedDecorations = tokens.filter((token) =>
        /(?:^|:)(?:rounded(?!-none(?:$|:))|bg-(?:gradient|linear|radial|conic)|(?:from|via|to)-|shadow(?!-none(?:$|:)))/.test(
          token
        )
      );
      expect(
        prohibitedDecorations,
        `Scrollbar track must stay square, flat, and shadow-free: ${tokens.join(' ')}`
      ).toEqual([]);
    }
    for (const token of [
      'absolute',
      'right-0',
      'top-0',
      'h-full',
      'w-4',
      'border-l-2',
      'border-foreground',
    ]) {
      expect(
        styleContains(vertical, token),
        `${token} :: ${vertical.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    for (const token of [
      'absolute',
      'bottom-0',
      'left-0',
      'h-4',
      'w-full',
      'border-t-2',
      'border-foreground',
    ]) {
      expect(
        styleContains(horizontal, token),
        `${token} :: ${horizontal.getAttribute('data-pui-style')}`
      ).toBe(true);
    }
    expect(vertical.getExposes().orientation?.get()).toBe('vertical');
    expect(horizontal.getExposes().orientation?.get()).toBe('horizontal');
  });

  it('thumb projects the complete surface token set', async () => {
    const root = document.createElement(BrutalistScrollAreaRoot.name) as any;
    const scrollbar = document.createElement(BrutalistScrollAreaScrollbar.name) as any;
    const thumb = document.createElement(BrutalistScrollAreaThumb.name) as any;
    root.appendChild(scrollbar);
    scrollbar.appendChild(thumb);
    document.body.appendChild(root);
    await flush();

    expect(styleContains(thumb, 'rounded-none')).toBe(true);
    expect(styleContains(thumb, 'bg-lavender-foreground')).toBe(true);
    expect(styleContains(thumb, 'relative')).toBe(true);
  });

  it('viewport projects the complete visual surface', async () => {
    const root = document.createElement(BrutalistScrollAreaRoot.name) as any;
    const viewport = document.createElement(BrutalistScrollAreaViewport.name) as any;
    root.appendChild(viewport);
    document.body.appendChild(root);
    await flush();

    expect(styleContains(viewport, 'h-full')).toBe(true);
    expect(styleContains(viewport, 'w-full')).toBe(true);
    expect(styleContains(viewport, 'block')).toBe(true);
    expect(styleContains(viewport, 'overflow-auto')).toBe(true);
    expect(styleContains(viewport, 'rounded-none')).toBe(true);
    expect(styleContains(viewport, 'outline-none')).toBe(true);
  });

  it('root projects the complete visual grammar', async () => {
    const root = document.createElement(BrutalistScrollAreaRoot.name) as any;
    document.body.appendChild(root);
    await flush();

    expect(root.getAttribute('data-pui-style')).not.toBeNull();
    expect(styleContains(root, 'relative')).toBe(true);
    expect(styleContains(root, 'overflow-hidden')).toBe(true);
  });
});
