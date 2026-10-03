import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DemoRuntimeApi, DemoSpec } from './demo-types';
import { renderDemo } from './demo-renderer';
import { loadPrototypes } from './prototype-modules';

// Only CDN acquisition is replaced. Frameworks, adapters, the renderer and
// Button are real installed implementations; this is host-unit, not browser evidence.
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

const dispose: Array<() => void | Promise<void>> = [];
beforeAll(async () => loadPrototypes(['base-button']), 20_000);
afterEach(async () => {
  for (const cleanup of dispose.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});

describe('Demo renderer declared refs with optional initial props', () => {
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const) {
    for (const explicitInitialBag of [false, true]) {
      it(`${runtime}: updates a declared nested ref with ${explicitInitialBag ? 'empty' : 'omitted'} initial props`, async () => {
        const host = document.createElement('div');
        document.body.append(host);
        const first = vi.fn();
        const next = vi.fn();
        let api!: DemoRuntimeApi;
        let wcCallback = first;
        const demo: DemoSpec = {
          type: 'demo',
          root: {
            kind: 'box',
            ref: 'container',
            children: [
              {
                kind: 'proto',
                prototypeId: 'base-button',
                ref: 'command',
                ...(explicitInitialBag ? { props: {} } : {}),
                children: ['Run'],
              },
            ],
          },
          setup(context) {
            api = context.api;
            const command = context.refs.command;
            const onSignal = (event: Event) => {
              if (event instanceof CustomEvent) wcCallback();
            };
            if (runtime === 'wc') command.addEventListener('click', onSignal);
            api.setProps('command', {
              disabled: true,
              ...(runtime === 'wc' ? {} : { onClick: first }),
            });
            return () => command.removeEventListener('click', onSignal);
          },
        };
        // This consumer regression observes protocol state, projected disabled
        // feedback and actual activation. It is not a new ARIA conformance test.
        const view = await renderDemo({ runtime, host, demo });
        dispose.push(() => view.destroy());
        const command = host.querySelector<HTMLElement>('[data-demo-ref="command"]')!;
        expect(command).not.toBeNull();
        await vi.waitFor(() => expect(api.call('command', 'disabled.get')).toBe(true));
        expect(command.hasAttribute('data-disabled')).toBe(true);
        await vi.waitFor(() => expect(command.getAttribute('aria-disabled')).toBe('true'));
        command.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(first).not.toHaveBeenCalled();

        api.setProps('command', {
          disabled: false,
          ...(runtime === 'wc' ? {} : { onClick: first }),
        });
        await vi.waitFor(() => expect(command.hasAttribute('data-disabled')).toBe(false));
        command.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(first).toHaveBeenCalledTimes(1);

        wcCallback = next;
        api.setProps('command', {
          disabled: false,
          ...(runtime === 'wc' ? {} : { onClick: next }),
        });
        // Vue consumers deliberately commit updated host callbacks on nextTick.
        for (let turn = 0; turn < 12; turn++) await Promise.resolve();
        command.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(first).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledTimes(1);

        api.setProps('command', { disabled: true, ...(runtime === 'wc' ? {} : { onClick: next }) });
        await vi.waitFor(() => expect(command.hasAttribute('data-disabled')).toBe(true));
        command.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        expect(next).toHaveBeenCalledTimes(1);
        expect(() => api.setProps('unknown', { disabled: true })).not.toThrow();
        expect(host.querySelectorAll('[data-demo-ref="command"]')).toHaveLength(1);
      }, 20_000);
    }
  }
});
