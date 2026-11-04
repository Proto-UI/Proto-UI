// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  tabsRoot,
  tabsList,
  tabsTrigger,
  tabsContent,
  tabsIndicator,
} from '@proto.ui/prototypes-base/tabs';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-tabs.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/tabs.mdx');

describe('Base Tabs documentation registration', () => {
  it('loads the actual public Base Tabs family prototypes lazily', async () => {
    expect(prototypeModules['base-tabs-root']).toBeTypeOf('function');
    await loadPrototype('base-tabs-root');
    expect(getPrototype('base-tabs-root')).toBe(tabsRoot);
    await loadPrototype('base-tabs-list');
    expect(getPrototype('base-tabs-list')).toBe(tabsList);
    await loadPrototype('base-tabs-trigger');
    expect(getPrototype('base-tabs-trigger')).toBe(tabsTrigger);
    await loadPrototype('base-tabs-content');
    expect(getPrototype('base-tabs-content')).toBe(tabsContent);
    await loadPrototype('base-tabs-indicator');
    expect(getPrototype('base-tabs-indicator')).toBe(tabsIndicator);
  });
  it.each(['en', 'zh-cn'])(
    'registers the tabs demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-tabs');
      expect(text).toContain('@proto.ui/prototypes-base/tabs');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Tabs discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/tabs'");
  });
  it('admits a Base-only declarative recipe with one root, one list of three triggers, an indicator, and three contents', () => {
    const recipe = (recipes['./demo-base-tabs.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Tabs recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('proto');
    expect(root.prototypeId).toBe('base-tabs-root');
    expect(root.props.defaultValue).toBe('account');
    const countChildrenIn = (node: any, prototypeId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === prototypeId ? 1 : 0;
      for (const child of node.children ?? []) count += countChildrenIn(child, prototypeId);
      return count;
    };
    const listCounts: number[] = [];
    const triggerCounts: number[] = [];
    const contentCounts: number[] = [];
    const indicatorCounts: number[] = [];
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-tabs-root') {
        listCounts.push(countChildrenIn(node, 'base-tabs-list'));
        triggerCounts.push(countChildrenIn(node, 'base-tabs-trigger'));
        contentCounts.push(countChildrenIn(node, 'base-tabs-content'));
        indicatorCounts.push(countChildrenIn(node, 'base-tabs-indicator'));
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots(root);
    expect(listCounts).toEqual([1]);
    expect(triggerCounts).toEqual([3]);
    expect(contentCounts).toEqual([3]);
    expect(indicatorCounts).toEqual([1]);
  });
});
