import * as baseTree from '@proto.ui/prototypes-base/tree';
import * as shadcnTree from '@proto.ui/prototypes-shadcn/tree';
import * as brutalistTree from '@proto.ui/prototypes-brutalist/tree';
import * as baseList from '@proto.ui/prototypes-base/virtual-list';
import * as shadcnList from '@proto.ui/prototypes-shadcn/virtual-list';
import * as brutalistList from '@proto.ui/prototypes-brutalist/virtual-list';
import { styleScope } from '@proto.ui/prototypes-shadcn/style-scope';
import type { Prototype } from '@proto.ui/core';
import type { WindowedCollection } from '@proto.ui/prototypes-base/virtual-list';
import { attachWebVirtualList } from '@proto.ui/prototypes-base/virtual-list/web';
import { afterEach, expect, it, vi } from 'vitest';
import baseTreeDemo from '../../content/docs/zh-cn/demo-base-tree.demo';
import shadcnTreeDemo from '../../content/docs/zh-cn/demo-shadcn-tree.demo';
import brutalistTreeDemo from '../../content/docs/zh-cn/demo-brutalist-tree.demo';
import baseListDemo from '../../content/docs/zh-cn/demo-base-virtual-list.demo';
import shadcnListDemo from '../../content/docs/zh-cn/demo-shadcn-virtual-list.demo';
import brutalistListDemo from '../../content/docs/zh-cn/demo-brutalist-virtual-list.demo';
import { renderDemo } from './demo-renderer';
import { registerPrototype } from './registry';
import type { DemoRuntimeApi, DemoSpec } from './demo-types';
// Only replace CDN acquisition. Each lane runs the public recipe, real
// framework, Adapter, prototype, authored composition and lifecycle cleanup.
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
  baseTree,
  shadcnTree,
  brutalistTree,
  baseList,
  shadcnList,
  brutalistList,
  { styleScope },
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
const lanes = ['wc', 'react', 'vue', 'vue2'] as const;
for (const [family, demo] of Object.entries({
  base: baseTreeDemo,
  shadcn: shadcnTreeDemo,
  brutalist: brutalistTreeDemo,
})) {
  for (const runtime of lanes)
    it(`${family}/${runtime} public Tree pairs its real Group and navigates RTL without changing selection`, async () => {
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
          },
        },
      });
      cleanups.push(() => view.destroy());
      const ref = (name: string) => host.querySelector<HTMLElement>(`[data-demo-ref="${name}"]`)!;
      const branchKey = family === 'base' ? 'project' : 'src';
      const groupRef = family === 'base' ? 'branch' : 'group-src';
      const childRef = family === 'base' ? 'readme' : 'components';
      const selectedValue = family === 'base' ? '' : 'button';
      await vi.waitFor(() =>
        expect(api.call('tree', 'getTree')).toHaveLength(family === 'base' ? 4 : 7)
      );
      expect(api.call('tree', 'invalid.get')).toBe(false);
      const project = ref(branchKey),
        group = ref(groupRef);
      expect(project.getAttribute('aria-controls')).toBe(group.id);
      expect(group.getAttribute('aria-labelledby')).toBe(project.id);
      api.setProps('tree', { direction: 'rtl' });
      await vi.waitFor(() =>
        expect(ref('tree').getAttribute('data-pui-style')).toContain('direction-rtl')
      );
      api.call(branchKey, 'focusSelf', { reason: 'keyboard' });
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(project);
        expect(api.call(branchKey, 'focused.get')).toBe(true);
      });
      const key = (value: string) =>
        document.activeElement!.dispatchEvent(
          new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })
        );
      // api.call also requests a Vue host update. Deliver the next physical
      // event only after that queued framework commit has rebound its host.
      await new Promise((resolve) => setTimeout(resolve, 0));
      key('ArrowRight');
      await vi.waitFor(() => expect(group.getAttribute('aria-hidden')).toBe('true'));
      expect(api.call(childRef, 'hidden.get')).toBe(true);
      key('ArrowLeft');
      await vi.waitFor(() => expect(group.getAttribute('aria-hidden')).toBe('false'));
      key('ArrowLeft');
      await vi.waitFor(() => expect(document.activeElement).toBe(ref(childRef)));
      expect(api.call('tree', 'value.get')).toBe(selectedValue);
      api.call('tree', 'requestExpanded', branchKey, false);
      await vi.waitFor(() => {
        expect(document.activeElement).toBe(project);
        expect(api.call(branchKey, 'focused.get')).toBe(true);
      });
      api.setProps('tree', { expandedKeys: [branchKey] });
      await vi.waitFor(() => expect(group.getAttribute('aria-hidden')).toBe('false'));
      api.call('tree', 'requestExpanded', branchKey, false);
      expect(api.call('tree', 'getExpandedKeys')).toEqual([branchKey]);
      expect(group.getAttribute('aria-hidden')).toBe('false');
    }, 30_000);
}
for (const [family, demo] of Object.entries({
  base: baseListDemo,
  shadcn: shadcnListDemo,
  brutalist: brutalistListDemo,
}) as [string, DemoSpec][]) {
  for (const runtime of lanes)
    it(`${family}/${runtime} public VirtualList bounds views and retires the actual Root materializer`, async () => {
      const host = document.createElement('div');
      document.body.append(host);
      let api!: DemoRuntimeApi, collection!: WindowedCollection;
      const view = await renderDemo({
        runtime,
        host,
        demo: {
          ...demo,
          setup(context) {
            api = context.api;
            Object.defineProperty(context.refs.viewport, 'clientHeight', { value: 160 });
            const cleanup = demo.setup?.(context);
            collection = api.call('list', 'getCollection') as WindowedCollection;
            return cleanup;
          },
        },
      });
      cleanups.push(() => view.destroy());
      await vi.waitFor(() => expect(collection.snapshot().status).toBe('committed'));
      expect(collection.snapshot().keys).toHaveLength(1000);
      const content = host.querySelector<HTMLElement>('[data-demo-ref="content"]')!;
      expect(content.querySelectorAll('[role="listitem"]').length).toBeGreaterThan(0);
      expect(content.querySelectorAll('[role="listitem"]').length).toBeLessThanOrEqual(60);
      const competitor = document.createElement('div');
      expect(() =>
        attachWebVirtualList({
          viewport: competitor,
          content: competitor,
          collection,
          renderItem: () => document.createElement('div'),
        })
      ).toThrow(/materializer/);
      expect(competitor.children).toHaveLength(0);
      await view.destroy();
      cleanups.pop();
      expect(content.children).toHaveLength(0);
      expect(() => collection.snapshot()).toThrow(/terminal disposal/);
    }, 30_000);
}
