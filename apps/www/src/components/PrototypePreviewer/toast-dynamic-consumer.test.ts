import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { collectPrototypeIds, type DemoSetupContext } from './demo-types';
import { loadPrototypes } from './prototype-modules';
import { createRuntimePreviewSurface } from './runtime-preview-surface';
import demo from '../../content/docs/demo-shadcn-toast.demo';

// Keep the real renderers and adapters; replace only CDN framework acquisition.
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

const views: Array<Awaited<ReturnType<typeof renderDemo>>> = [];
beforeAll(async () => {
  const ids = new Set<string>();
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    collectPrototypeIds(createRuntimePreviewSurface(demo, 'shadcn', {}, runtime).demo.root, ids);
  }
  await loadPrototypes([...ids]);
}, 20_000);
afterEach(async () => {
  for (const view of views.splice(0).reverse()) await view.destroy();
  document.body.replaceChildren();
});

describe('Shadcn Toast continuous creation in the real demo renderers', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    it(`${runtime}: retains unique messages across rapid creates, removal and retirement`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let context!: DemoSetupContext;
      const surface = createRuntimePreviewSurface(
        {
          ...demo,
          setup(ctx) {
            context = ctx;
            return demo.setup?.(ctx);
          },
        },
        'shadcn',
        { '--pui-background': 'rgb(11, 22, 33)' },
        runtime
      );
      const view = await renderDemo({
        runtime,
        host,
        demo: surface.demo,
      });
      views.push(view);
      const { api } = context;
      await vi.waitFor(() => expect(typeof api.getExposes('trigger')?.focusSelf).toBe('function'));
      await vi.waitFor(() => {
        const viewport = context.refs.viewport;
        expect(viewport?.isConnected).toBe(true);
        expect(host.contains(viewport)).toBe(false);
        expect(viewport.style.getPropertyValue('--pui-background')).toBe('rgb(11, 22, 33)');
      });
      api.call('viewport', 'pauseAll');
      const trigger = context.refs.trigger;

      for (let index = 0; index < 3; index++) trigger.click();
      await vi.waitFor(() => expect(api.call('root-2', 'open.get')).toBe(true));
      const first = api.getPublicInstance?.('root-0');
      expect(first).toBeDefined();
      for (let index = 3; index < 12; index++) trigger.click();

      await vi.waitFor(() => expect(api.call('root-11', 'open.get')).toBe(true));
      expect(api.getPublicInstance?.('root-0')).toBe(first);
      const instances = Array.from({ length: 12 }, (_, index) =>
        api.getPublicInstance?.(`root-${index}`)
      );
      expect(instances.every(Boolean)).toBe(true);
      expect(new Set(instances).size).toBe(12);
      expect(
        Array.from({ length: 12 }, (_, index) => api.call(`root-${index}`, 'stackTier.get'))
      ).toEqual([...Array(9).fill('overflow'), 'third', 'second', 'front']);

      // Real Close activation removes its message; a simultaneous create must
      // retain the latest canonical list through queued snapshot coalescing.
      await vi.waitFor(() => expect(context.refs['close-11']?.isConnected).toBe(true));
      context.refs['close-11'].click();
      api.call('root-1', 'close');
      trigger.click();
      await vi.waitFor(() => {
        expect(api.getPublicInstance?.('root-11')).toBeUndefined();
        expect(api.getPublicInstance?.('root-1')).toBeUndefined();
        expect(api.call('root-12', 'open.get')).toBe(true);
      });
      expect(api.getPublicInstance?.('root-0')).toBe(first);
      expect(api.call('root-12', 'stackTier.get')).toBe('front');
      expect(api.call('root-10', 'stackTier.get')).toBe('second');

      // Timeout follows the same outward event/removal path as user dismissal.
      api.setProps('root-12', { duration: 1 });
      api.call('viewport', 'resumeAll');
      await vi.waitFor(() => expect(api.getPublicInstance?.('root-12')).toBeUndefined());

      trigger.click();
      await view.destroy();
      trigger.click();
      expect(api.getPublicInstance?.('root-13')).toBeUndefined();
      expect(document.querySelector('[data-demo-ref^="root-"]')).toBeNull();
    }, 20_000);
  }
});
