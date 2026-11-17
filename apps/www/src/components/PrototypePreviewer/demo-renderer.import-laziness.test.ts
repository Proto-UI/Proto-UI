import { afterEach, describe, expect, it, vi } from 'vitest';

const imported = vi.hoisted(() => vi.fn());
const loaded = vi.hoisted(() => vi.fn());
const reactAdapterImport = vi.hoisted(() => ({ gate: undefined as Promise<void> | undefined }));
vi.mock('@proto.ui/adapter-react', async () => {
  imported('react-adapter');
  if (reactAdapterImport.gate) await reactAdapterImport.gate;
  return { createReactAdapter: vi.fn() };
});
vi.mock('@proto.ui/adapter-vue', () => {
  imported('vue-adapter');
  return { createVueAdapter: vi.fn() };
});
vi.mock('@proto.ui/adapter-vue2', () => {
  imported('vue2-adapter');
  return { createVue2Adapter: vi.fn() };
});
vi.mock('./runtimes/react-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/react-runtime')>();
  imported('react-runtime');
  return {
    ...actual,
    loadReact: async () => {
      loaded('react');
      throw new Error('react load failed');
    },
  };
});
vi.mock('./runtimes/vue-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue-runtime')>();
  imported('vue-runtime');
  return {
    ...actual,
    loadVue: async () => {
      loaded('vue');
      throw new Error('vue load failed');
    },
  };
});
vi.mock('./runtimes/vue2-runtime', async (original) => {
  const actual = await original<typeof import('./runtimes/vue2-runtime')>();
  imported('vue2-runtime');
  return {
    ...actual,
    toVue2ComponentData: vi.fn(),
    toVue2Runtime: vi.fn(),
    loadVue2: async () => {
      loaded('vue2');
      throw new Error('vue2 load failed');
    },
  };
});

// Count module-factory evaluation, not renderer calls: eagerly importing an
// unused adapter would fail the first assertion even if it never mounts.
import { prepareDemoRuntime, renderDemo } from './demo-renderer';

afterEach(() => document.body.replaceChildren());

describe('demo renderer runtime module activation', () => {
  it('does not import framework modules for initial WC preparation or rendering', async () => {
    expect(imported).not.toHaveBeenCalled();
    await prepareDemoRuntime('wc');
    const host = document.createElement('div');
    document.body.append(host);
    const rendered = await renderDemo({
      runtime: 'wc',
      host,
      demo: {
        type: 'demo',
        root: { kind: 'box', children: [{ kind: 'text', text: 'WC content' }] },
      },
    });
    expect(host.textContent).toBe('WC content');
    expect(imported).not.toHaveBeenCalled();
    rendered.destroy();
  });

  it.each(['react', 'vue', 'vue2'] as const)(
    'loads only selected %s modules and preserves load errors',
    async (runtime) => {
      const before = imported.mock.calls.length;
      const beforeLoad = loaded.mock.calls.length;
      const gate = runtime === 'react' ? Promise.withResolvers<void>() : undefined;
      reactAdapterImport.gate = gate?.promise;
      // Three Search commands prepare concurrently. The asynchronous original
      // module acquisition must finish once before any consumer uses its loader.
      const hosts = Array.from({ length: 3 }, () => document.createElement('div'));
      document.body.append(...hosts);
      const attempts = hosts.map((host) =>
        renderDemo({
          runtime,
          host,
          demo: { type: 'demo', root: { kind: 'box', children: [] } },
        })
      );
      const pending = Promise.allSettled(attempts);
      try {
        if (gate)
          await vi.waitFor(() =>
            expect(loaded.mock.calls.slice(beforeLoad)).toEqual([['react'], ['react'], ['react']])
          );
      } finally {
        gate?.resolve();
        reactAdapterImport.gate = undefined;
        await pending;
      }
      for (const result of await pending) {
        expect(result.status).toBe('rejected');
        if (result.status === 'rejected')
          expect(result.reason.message).toBe(`${runtime} load failed`);
      }
      expect(
        imported.mock.calls
          .slice(before)
          .map(([name]) => name)
          .sort()
      ).toEqual([`${runtime}-adapter`, `${runtime}-runtime`]);
      for (const host of hosts) expect(host.childNodes).toHaveLength(0);
    }
  );
  it.each(['react', 'vue', 'vue2'] as const)(
    'does not load %s after an import-boundary lease replacement',
    async (runtime) => {
      const host = document.createElement('div');
      document.body.append(host);
      const before = loaded.mock.calls.length;
      const stale = renderDemo({
        runtime,
        host,
        demo: {
          type: 'demo',
          root: { kind: 'box', children: [] },
        },
      });
      const current = await renderDemo({
        runtime: 'wc',
        host,
        demo: {
          type: 'demo',
          root: { kind: 'box', children: [{ kind: 'text', text: 'Current owner' }] },
        },
      });
      await stale;
      expect(loaded.mock.calls.length).toBe(before);
      expect(host.textContent).toBe('Current owner');
      current.destroy();
    }
  );
});
