import * as baseTable from '@proto.ui/prototypes-base/data-table';
import * as shadcnTable from '@proto.ui/prototypes-shadcn/data-table';
import * as brutalistTable from '@proto.ui/prototypes-brutalist/data-table';
import baseInput from '@proto.ui/prototypes-base/input';
import shadcnInput from '@proto.ui/prototypes-shadcn/input';
import brutalistInput from '@proto.ui/prototypes-brutalist/input';
import baseButton from '@proto.ui/prototypes-base/button';
import shadcnButton from '@proto.ui/prototypes-shadcn/button';
import brutalistButton from '@proto.ui/prototypes-brutalist/button';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import type { Prototype } from '@proto.ui/core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import baseDemo from '../../content/docs/zh-cn/demo-base-data-table-recipes.demo';
import shadcnDemo from '../../content/docs/zh-cn/demo-shadcn-data-table-recipes.demo';
import brutalistDemo from '../../content/docs/zh-cn/demo-brutalist-data-table-recipes.demo';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
import type { DemoRuntimeApi } from './demo-types';

// Only replace CDN acquisition. Each lane runs the public recipe, real
// framework, Adapter, prototype, native Input bridge and lifecycle cleanup.
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
for (const library of [
  baseTable,
  shadcnTable,
  brutalistTable,
  { baseInput, shadcnInput, brutalistInput, baseButton, shadcnButton, brutalistButton, styleScope },
]) {
  for (const value of Object.values(library)) {
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value) {
      const prototype = value as Prototype<any, any>;
      registerPrototype(prototype.name, prototype);
    }
  }
}
const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
for (const [family, demo] of Object.entries({
  base: baseDemo,
  shadcn: shadcnDemo,
  brutalist: brutalistDemo,
})) {
  describe(`${family} public DataTable recipes`, () => {
    it.each(['wc', 'react', 'vue', 'vue2'] as const)(
      '%s filters, formats, selects, hides and restores columns with actual controls',
      async (runtime) => {
        const host = document.createElement('div');
        document.body.append(host);
        let api!: DemoRuntimeApi;
        const view = await renderDemo({
          runtime,
          host,
          demo: {
            ...demo,
            setup(context) {
              api = context.api;
              return demo.setup?.(context);
            },
          },
        });
        cleanups.push(() => view.destroy());
        const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
        await vi.waitFor(() => {
          expect(ref('row-0').textContent).toBe('API[READY]');
          expect(ref('row-1').textContent).toBe('Website[BUSY]');
        });
        expect(api.call('table', 'getStructure')).toMatchObject({ valid: true, columnCount: 2 });
        ref('select-page').click();
        await vi.waitFor(() =>
          expect(api.call('table', 'getSelectedKeys')).toEqual(['api', 'web'])
        );
        await vi.waitFor(() =>
          expect(ref('selection-summary').textContent).toContain('2 selected; current page: all')
        );
        ref('next').click();
        await vi.waitFor(() => expect(ref('row-0').textContent).toBe('Docs[READY]'));
        expect(api.call('table', 'pageSelection.get')).toBe('none');
        ref('select-page').click();
        await vi.waitFor(() =>
          expect(api.call('table', 'getSelectedKeys')).toEqual(['api', 'web', 'docs'])
        );
        ref('select-page').click();
        await vi.waitFor(() =>
          expect(api.call('table', 'getSelectedKeys')).toEqual(['api', 'web'])
        );
        const inputHost = ref('name-filter');
        const input = (
          inputHost.matches('input') ? inputHost : inputHost.querySelector('input')
        ) as HTMLInputElement;
        expect(input).not.toBeNull();
        input.value = 'Web';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await vi.waitFor(() => expect(ref('row-0').textContent).toBe('Website[BUSY]'));
        expect(api.call('table', 'filteredCount.get')).toBe(1);
        expect(api.call('table', 'pageSelection.get')).toBe('all');
        const status = ref('state-0'),
          formatted = ref('formatted-0');
        ref('toggle-status').click();
        await vi.waitFor(() => expect(status.getAttribute('aria-hidden')).toBe('true'));
        expect(status.getAttribute('data-pui-style')).toContain('hidden');
        expect(ref('state-header').tabIndex).toBe(-1);
        expect(ref('formatted-0')).toBe(formatted);
        expect(api.call('table', 'getStructure')).toMatchObject({ valid: true, columnCount: 2 });
        ref('toggle-status').click();
        await vi.waitFor(() => expect(status.getAttribute('aria-hidden')).toBe('false'));
        expect(ref('state-0')).toBe(status);
        expect(ref('row-0').textContent).toBe('Website[BUSY]');
        api.setProps('table', { rows: [{ id: 'web', name: 'Website', state: 'updated' }] });
        await vi.waitFor(() => expect(ref('row-0').textContent).toBe('Website[UPDATED]'));
        const header = ref('name-header');
        header.focus();
        const down = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        header.dispatchEvent(down);
        header.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', bubbles: true }));
        await vi.waitFor(() => expect(header.getAttribute('aria-sort')).toBe('ascending'));
        expect(down.defaultPrevented).toBe(true);
        await view.destroy();
        cleanups.pop();
        expect(host.childElementCount).toBe(0);
      },
      30_000
    );
  });
}
