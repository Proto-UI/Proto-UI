import * as React from 'react';
import { createPortal, flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import * as Vue from 'vue';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Vue2Any } from '../../adapters/vue2/test/utils/vue2';

import { renderDemo } from '../../../apps/www/src/components/PrototypePreviewer/demo-renderer';
import { loadPrototypes } from '../../../apps/www/src/components/PrototypePreviewer/prototype-modules';
import {
  AdapterIds,
  type RuntimeId,
} from '../../../apps/www/src/components/PrototypePreviewer/runtimes/registry';
import brutalistScrollAreaDemo from '../../../apps/www/src/content/docs/zh-cn/demo-brutalist-scroll-area.demo';

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/react-runtime', () => ({
  loadReact: vi.fn(async () => ({
    React,
    ReactDOM: { createPortal, createRoot, flushSync },
  })),
}));

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue-runtime', () => ({
  loadVue: vi.fn(async () => Vue),
}));

vi.mock('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime', async () => {
  const actual = await vi.importActual<
    typeof import('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime')
  >('../../../apps/www/src/components/PrototypePreviewer/runtimes/vue2-runtime');
  return { ...actual, loadVue2: vi.fn(async () => Vue2Any) };
});

const WEB_ADAPTERS = ['wc', 'react', 'vue', 'vue2'] as const satisfies readonly RuntimeId[];
const SCROLL_AREA_PROTOTYPES = [
  'brutalist-scroll-area-root',
  'brutalist-scroll-area-viewport',
  'brutalist-scroll-area-scrollbar',
  'brutalist-scroll-area-thumb',
] as const;

async function settle(): Promise<void> {
  await Promise.resolve();
  await Vue.nextTick();
  await Vue2Any.nextTick();
  await Promise.resolve();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await Promise.resolve();
}

function requireRef(host: HTMLElement, ref: string): HTMLElement {
  const target = host.querySelector<HTMLElement>(`[data-demo-ref="${ref}"]`);
  expect(target, `expected demo ref "${ref}"`).toBeTruthy();
  return target!;
}

function setScrollMetrics(target: HTMLElement): void {
  Object.defineProperties(target, {
    clientWidth: { configurable: true, value: 100 },
    scrollWidth: { configurable: true, value: 100 },
    clientHeight: { configurable: true, value: 100 },
    scrollHeight: { configurable: true, value: 400 },
    scrollLeft: { configurable: true, value: 0, writable: true },
    scrollTop: { configurable: true, value: 0, writable: true },
  });
}

function pointer(type: string, clientY: number): PointerEvent {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 7,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    clientX: 5,
    clientY,
  });
}

beforeAll(async () => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = false;
  expect([...WEB_ADAPTERS]).toEqual(AdapterIds);
  await loadPrototypes([...SCROLL_AREA_PROTOTYPES]);
});

afterAll(() => {
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

describe('Web adapter conformance / Brutalist Scroll Area Move journey', () => {
  it.each(WEB_ADAPTERS)(
    '%s maps the shared Thumb movement to the host-owned scroll surface',
    async (runtime) => {
      const host = document.createElement('div');
      document.body.append(host);
      const session = await renderDemo({
        runtime,
        demo: brutalistScrollAreaDemo as any,
        host,
      });

      try {
        await settle();
        const viewport = requireRef(host, 'scrollViewport');
        const scrollbar = requireRef(host, 'scrollbar');
        const thumb = requireRef(host, 'thumb');
        setScrollMetrics(viewport);
        Object.defineProperty(scrollbar, 'clientHeight', { configurable: true, value: 100 });
        scrollbar.style.paddingTop = '2px';
        scrollbar.style.paddingBottom = '2px';
        scrollbar.getBoundingClientRect = () =>
          ({ top: 0, left: 0, width: 10, height: 100 }) as DOMRect;
        thumb.getBoundingClientRect = () => ({ top: 2, left: 0, width: 10, height: 24 }) as DOMRect;

        window.dispatchEvent(new Event('resize'));
        await settle();

        expect(viewport.dataset.puiScrollProjection).toBe('composed');
        expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-size')).toBe('24px');
        expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('0px');
        expect(thumb.style.touchAction).toBe('none');
        expect(thumb.getAttribute('role')).toBeNull();
        expect(thumb.tabIndex).toBe(-1);

        thumb.dispatchEvent(pointer('pointerdown', 4));
        expect(viewport.scrollTop).toBe(0);
        thumb.dispatchEvent(pointer('pointermove', 40));
        thumb.dispatchEvent(pointer('pointerup', 40));

        expect(viewport.scrollTop).toBe(150);
        expect(thumb.style.getPropertyValue('--proto-ui-scroll-thumb-offset')).toBe('36px');
        expect(thumb.getAttribute('role')).toBeNull();
        expect(thumb.tabIndex).toBe(-1);
      } finally {
        await session.destroy();
        host.remove();
      }
    },
    20_000
  );
});
