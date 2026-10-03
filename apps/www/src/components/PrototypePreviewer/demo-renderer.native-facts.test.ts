import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHomepageContent } from '../Homepage/homepage-runtime-client';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import type { DemoRuntimeApi } from './demo-types';
// Only CDN acquisition is replaced. Frameworks, adapters, the renderer and
// Prototypes are real installed implementations; this is host-unit, not browser evidence.
vi.mock('./runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/react-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/react/package.json'));
  return {
    ...actual,
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue/package.json'));
  return { ...actual, loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const { resolve } = await import('node:path');
  const require = createRequire(resolve('packages/adapters/vue2/package.json'));
  return { ...actual, loadVue2: async () => require('vue') };
});

const cleanups: Array<() => void | Promise<void>> = [];
beforeAll(async () => loadPrototypes(['site-link-surface']), 20_000);
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
describe('native link facts through actual renderer props', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: preserves pressed feedback through pointerdown then native focus`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const source = document.createElement('a');
      source.href = 'https://github.com/Proto-UI/Proto-UI';
      source.dataset.siteLinkIcon = 'github';
      source.dataset.siteLinkAppearance = 'icon';
      source.setAttribute('aria-label', 'GitHub');
      const demo = createHomepageContent(
        {
          root: host,
          mount: host,
          fallback: host,
          ownerId: 'native-test',
          links: [source],
          theme: false,
          runtime: false,
        },
        runtime,
        () => true,
        'brutalist'
      );
      const events: unknown[] = [];
      const setup = demo.setup!;
      demo.setup = (context) => {
        const set = context.api.setProps;
        context.api.setProps = (ref, next) => {
          events.push({ ref, next: { ...next } });
          set(ref, next);
        };
        return setup(context);
      };
      const view = await renderDemo({ runtime, host, demo });
      cleanups.push(() => view.destroy());
      const link = host.querySelector('a')!;
      const tokens = () =>
        link.querySelector('[data-pui-root]')?.getAttribute('data-pui-style')?.split(/\s+/) ?? [];
      link.dispatchEvent(new PointerEvent('pointerenter'));
      await vi.waitFor(() => expect(tokens()).toContain('translate-x-1'));
      link.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      link.focus();
      await vi.waitFor(() => expect(tokens()).toContain('translate-y-1'));
      expect(events.some((event: any) => event.next.pressed === true)).toBe(true);
      expect(tokens()).toContain('shadow-none');
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      await vi.waitFor(() => expect((events.at(-1) as any).next.pressed).toBe(false));
      // Hover and press share the same endpoint. The real props lease must still
      // clear pressed, and only leaving hover restores resting elevation.
      expect(tokens()).toContain('translate-y-1');
      link.dispatchEvent(new PointerEvent('pointerleave'));
      await vi.waitFor(() => expect(tokens()).not.toContain('translate-y-1'));
      expect(link.isConnected).toBe(true);
      expect(host.querySelectorAll('a')).toHaveLength(1);
      // Later independent props remain live; the first hover update is not enough.
      link.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      await vi.waitFor(() => expect(tokens()).toContain('translate-y-1'));
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      await vi.waitFor(() => expect(tokens()).not.toContain('translate-y-1'));
      await view.destroy();
      const eventsAfterDispose = events.length;
      link.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointerup', { button: 0 }));
      await Promise.resolve();
      expect(events).toHaveLength(eventsAfterDispose);
      expect(host.childElementCount).toBe(0);
    }, 20_000);

    it(`${runtime}: late props from a replaced owner cannot change its replacement`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const source = document.createElement('a');
      source.href = '/en/';
      source.dataset.siteLinkIcon = 'github';
      source.dataset.siteLinkAppearance = 'icon';
      source.setAttribute('aria-label', 'GitHub');
      const group = {
        root: host,
        mount: host,
        fallback: host,
        ownerId: 'lease-test',
        links: [source],
        theme: false,
        runtime: false,
      };
      const first = createHomepageContent(group, runtime, () => true, 'brutalist');
      const setup = first.setup!;
      let staleApi!: DemoRuntimeApi;
      first.setup = (context) => {
        staleApi = context.api;
        return setup(context);
      };
      const old = await renderDemo({ runtime, host, demo: first });
      cleanups.push(() => old.destroy());
      const oldLink = host.querySelector('a')!;
      oldLink.dispatchEvent(new PointerEvent('pointerenter'));
      oldLink.dispatchEvent(new PointerEvent('pointerdown', { button: 0, bubbles: true }));
      // Revoke while framework prop delivery can still be queued.
      const replacing = renderDemo({
        runtime,
        host,
        demo: createHomepageContent(group, runtime, () => true, 'shadcn'),
      });
      staleApi.setProps('home-link-surface-0', { pressed: true, family: 'brutalist' });
      const current = await replacing;
      cleanups.push(() => current.destroy());
      staleApi.setProps('home-link-surface-0', {
        pressed: true,
        hovered: true,
        family: 'brutalist',
      });
      for (let turn = 0; turn < 12; turn++) await Promise.resolve();
      const link = host.querySelector('a')!;
      expect(link).not.toBe(oldLink);
      expect(oldLink.isConnected).toBe(false);
      expect(host.querySelectorAll('a')).toHaveLength(1);
      const surface = link.querySelector('[data-pui-root]')!;
      const tokens = (surface.getAttribute('data-pui-style') ?? '').split(/\s+/);
      expect(tokens).toContain('rounded-lg');
      expect(tokens).not.toContain('rounded-base');
      expect(tokens).not.toContain('translate-y-1');
      expect(tokens).not.toContain('translate-x-1');
      expect(tokens).not.toContain('bg-main');
    }, 20_000);
  }
});
