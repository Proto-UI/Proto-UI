import * as baseSelect from '@proto.ui/prototypes-base/select';
import * as shadcnSelect from '@proto.ui/prototypes-shadcn/select';
import * as brutalistSelect from '@proto.ui/prototypes-brutalist/select';
import * as baseButton from '@proto.ui/prototypes-base/button';
import * as shadcnButton from '@proto.ui/prototypes-shadcn/button';
import * as brutalistButton from '@proto.ui/prototypes-brutalist/button';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import type { Prototype } from '@proto.ui/core';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import baseDemo from '../../content/docs/demo-base-select-input.demo';
import shadcnDemo from '../../content/docs/demo-shadcn-select-input.demo';
import brutalistDemo from '../../content/docs/demo-brutalist-select-input.demo';
import { prepareDemoRuntime, renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
import type { DemoRuntimeApi } from './demo-types';
// Only substitute CDN acquisition. These are the public recipe and real
// framework/Adapter instances, including their actual update and teardown paths.
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
  baseSelect,
  shadcnSelect,
  brutalistSelect,
  baseButton,
  shadcnButton,
  brutalistButton,
  { styleScope },
])
  for (const value of Object.values(library))
    if (value && typeof value === 'object' && 'name' in value && 'setup' in value) {
      const prototype = value as Prototype<any, any>;
      registerPrototype(prototype.name, prototype);
    }
const cleanups: Array<() => void | Promise<void>> = [];
// Each case exercises a mounted selection owner. Load its actual framework before mounting.
for (const runtime of ['react', 'vue', 'vue2'] as const)
  beforeAll(() => prepareDemoRuntime(runtime));
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
for (const [family, demo] of Object.entries({
  base: baseDemo,
  shadcn: shadcnDemo,
  brutalist: brutalistDemo,
}))
  for (const runtime of ['wc', 'react', 'vue', 'vue2'] as const)
    it(`${family}/${runtime} public Select composes the scroll viewport and owner refusal`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let api!: DemoRuntimeApi;
      let refs!: Record<string, HTMLElement>;
      const view = await renderDemo({
        runtime,
        host,
        demo: {
          ...demo,
          setup(context) {
            api = context.api;
            refs = context.refs;
            return demo.setup?.(context);
          },
        },
      });
      let cleaned = false;
      cleanups.push(async () => {
        if (!cleaned) await view.destroy();
      });
      const x = (name: string) => api.getExposes(name) as any;
      if (family === 'base') {
        await vi.waitFor(() => expect(x('select').value.get()).toBe('alpha'));
        expect(x('select').getCollectionCount()).toBe(18);
        expect(x('item3').disabled.get()).toBe(true);
        api.call('select', 'openDropdown', 'recipe');
        await vi.waitFor(() => expect(refs.selectViewport).toBeDefined());
        const viewport = refs.selectViewport;
        expect(viewport.style.maxHeight).toBe('180px');
        expect(viewport.style.overflowY).toBe('auto');
        refs.toggleRefusal.click();
        await flush();
        expect(refs.selectPolicy.textContent).toContain('controlled-refusal');
        expect(
          api.call('select', 'requestValue', {
            value: 'beta',
            textValue: 'beta',
            reason: 'programmatic',
          })
        ).toBe(true);
        await flush();
        expect(x('select').value.get()).toBe('alpha');
        expect(refs.selectRequests.textContent).toContain('requested=beta');
        refs.toggleRefusal.click();
        await flush();
        expect(
          api.call('select', 'requestValue', {
            value: 'gamma',
            textValue: 'gamma',
            reason: 'programmatic',
          })
        ).toBe(true);
        await flush();
        expect(x('select').value.get()).toBe('gamma');
        expect(x('item2').selected.get()).toBe(true);
        expect(refs.selectPolicy.textContent).toContain('owner=uncontrolled value=gamma');
        const content = refs.selectContent;
        await view.destroy();
        cleaned = true;
        await flush();
        expect(host.childElementCount).toBe(0);
        expect(content.isConnected).toBe(false);
        return;
      }

      if (family === 'shadcn') {
        await vi.waitFor(() => expect(x('controlledSelect').value.get()).toBe('system'));
        expect(x('controlledSelect').getCollectionCount()).toBe(4);
        expect(refs.selectedTheme.textContent).toContain('Selected: System');
        const trigger = host.querySelector<HTMLElement>('[role="combobox"]')!;
        await vi.waitFor(() => expect(trigger.textContent?.trim()).toBe('System'));
        trigger.click();
        const option = (label: string) => {
          const listbox = document.getElementById(trigger.getAttribute('aria-controls')!);
          return Array.from(listbox?.querySelectorAll<HTMLElement>('[role="option"]') ?? []).find(
            (item) => item.textContent?.trim() === label
          );
        };
        const disabled = await vi.waitFor(() => {
          const item = option('High Contrast (Coming soon)');
          expect(item?.getAttribute('aria-disabled')).toBe('true');
          return item!;
        });
        disabled.click();
        await flush();
        expect(x('controlledSelect').value.get()).toBe('system');
        expect(refs.selectedTheme.textContent).toContain('Selected: System');
        expect(trigger.textContent?.trim()).toBe('System');
        expect(trigger.getAttribute('aria-expanded')).toBe('true');
        for (const activateDark of [
          () => option('Dark')!.click(),
          () =>
            expect(
              api.call('controlledSelect', 'requestValue', {
                value: 'dark',
                textValue: 'Dark',
                reason: 'programmatic',
              })
            ).toBe(true),
        ]) {
          activateDark();
          await vi.waitFor(() => {
            expect(x('controlledSelect').value.get()).toBe('dark');
            expect(trigger.textContent?.trim()).toBe('Dark');
            expect(refs.selectedTheme.textContent).toContain('Selected: Dark');
          });
          refs.resetTheme.click();
          await vi.waitFor(() => {
            expect(x('controlledSelect').value.get()).toBe('system');
            expect(trigger.textContent?.trim()).toBe('System');
            expect(refs.selectedTheme.textContent).toContain('Selected: System');
          });
        }
        await view.destroy();
        cleaned = true;
        await flush();
        expect(host.childElementCount).toBe(0);
        return;
      }

      await vi.waitFor(() => expect(x('timezoneSelect').value.get()).toBe('jst'));
      expect(x('timezoneSelect').getCollectionCount()).toBe(12);
      api.call('timezoneSelect', 'openDropdown', 'recipe');
      await flush();
      const content = document.body.querySelector<HTMLElement>('[role="listbox"]');
      expect(content).not.toBeNull();
      expect(content!.style.maxHeight).toBe('200px');
      expect(content!.style.overflowY).toBe('auto');
      expect(
        api.call('timezoneSelect', 'requestValue', {
          value: 'est',
          textValue: 'Eastern Standard Time (EST)',
          reason: 'programmatic',
        })
      ).toBe(true);
      await vi.waitFor(() => expect(x('timezoneSelect').value.get()).toBe('est'));
      refs.resetTimezone.click();
      await vi.waitFor(() => expect(x('timezoneSelect').value.get()).toBe('jst'));
      await view.destroy();
      cleaned = true;
      await flush();
      expect(host.childElementCount).toBe(0);
      expect(content!.isConnected).toBe(false);
    });
