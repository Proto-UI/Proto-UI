import { afterEach, expect, it, vi } from 'vitest';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';
import type { DemoSpec, DemoRuntimeApi } from './demo-types';
// Real adapters and installed frameworks; only the network/CDN loaders are replaced.
vi.mock('./runtimes/react-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/react/package.json');
  return {
    loadReact: async () => ({
      React: require('react'),
      ReactDOM: { ...require('react-dom'), ...require('react-dom/client') },
    }),
  };
});
vi.mock('./runtimes/vue-runtime', async () => {
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/apps/www/package.json');
  return { loadVue: async () => require('vue') };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const current = await original<typeof import('./runtimes/vue2-runtime')>();
  const { createRequire } = await import('node:module');
  const require = createRequire(process.cwd() + '/packages/adapters/vue2/package.json');
  return { ...current, loadVue2: async () => require('vue') };
});

const active: { destroy: () => Promise<void> | void }[] = [];
afterEach(async () => {
  for (const view of active.splice(0)) await view.destroy();
  document.body.replaceChildren();
});
it.each(['wc', 'react', 'vue', 'vue2'] as const)(
  '%s preserves declaration admission across close and reopen',
  async (runtime) => {
    let api: DemoRuntimeApi | undefined;
    const demo: DemoSpec = {
      type: 'demo',
      root: {
        kind: 'proto',
        prototypeId: 'base-drawer-root',
        ref: 'root',
        props: { defaultOpen: true },
        children: [
          {
            kind: 'proto',
            prototypeId: 'base-drawer-mask',
            ref: 'mask',
            props: { enterDuration: 0, leaveDuration: 0 },
          },
          {
            kind: 'proto',
            prototypeId: 'base-drawer-content',
            ref: 'panel',
            props: { enterDuration: 0, leaveDuration: 0 },
            children: [{ kind: 'proto', prototypeId: 'base-drawer-close', children: ['Close'] }],
          },
        ],
      },
      setup(context) {
        api = context.api;
      },
    };
    await loadPrototypes([
      'base-drawer-root',
      'base-drawer-mask',
      'base-drawer-content',
      'base-drawer-close',
    ]);
    const host = document.createElement('div');
    document.body.append(host);
    const view = await renderDemo({ runtime, host, demo });
    active.push(view);
    const state = (ref: string, key: string) =>
      (api!.getExposes(ref)?.[key] as { get(): boolean }).get();
    await vi.waitFor(() => {
      expect(api).toBeDefined();
      expect(state('panel', 'isPresent')).toBe(true);
      expect(state('mask', 'isPresent')).toBe(true);
    });
    api!.call('root', 'close');
    await vi.waitFor(() => {
      expect(state('panel', 'isPresent')).toBe(false);
      expect(state('mask', 'isPresent')).toBe(false);
    });
    api!.call('root', 'openDrawer');
    await vi.waitFor(() => {
      expect(state('panel', 'isPresent')).toBe(true);
      expect(state('mask', 'isPresent')).toBe(true);
    });
  }
);
