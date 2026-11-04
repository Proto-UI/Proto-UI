// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  selectRoot,
  selectTrigger,
  selectValue,
  selectContent,
  selectItem,
} from '@proto.ui/prototypes-base/select';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-select.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/select.mdx');

describe('Base Select documentation registration', () => {
  it('loads the actual public Base Select family prototypes lazily', async () => {
    expect(prototypeModules['base-select-root']).toBeTypeOf('function');
    await loadPrototype('base-select-root');
    expect(getPrototype('base-select-root')).toBe(selectRoot);
    await loadPrototype('base-select-trigger');
    expect(getPrototype('base-select-trigger')).toBe(selectTrigger);
    await loadPrototype('base-select-value');
    expect(getPrototype('base-select-value')).toBe(selectValue);
    await loadPrototype('base-select-content');
    expect(getPrototype('base-select-content')).toBe(selectContent);
    await loadPrototype('base-select-item');
    expect(getPrototype('base-select-item')).toBe(selectItem);
  });
  it.each(['en', 'zh-cn'])(
    'registers the select demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-select');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Select discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/select'");
  });
  it('admits a Base-only declarative recipe with one trigger, one value, and three items', () => {
    const recipe = (recipes['./demo-base-select.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Select recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('proto');
    expect(root.prototypeId).toBe('base-select-root');
    const countChildrenIn = (node: any, prototypeId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === prototypeId ? 1 : 0;
      for (const child of node.children ?? []) count += countChildrenIn(child, prototypeId);
      return count;
    };
    const triggerCounts: number[] = [];
    const valueCounts: number[] = [];
    const contentCounts: number[] = [];
    const itemCounts: number[] = [];
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-select-root') {
        triggerCounts.push(countChildrenIn(node, 'base-select-trigger'));
        valueCounts.push(countChildrenIn(node, 'base-select-value'));
        contentCounts.push(countChildrenIn(node, 'base-select-content'));
        itemCounts.push(countChildrenIn(node, 'base-select-item'));
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots(root);
    expect(triggerCounts).toEqual([1]);
    expect(valueCounts).toEqual([1]);
    expect(contentCounts).toEqual([1]);
    expect(itemCounts).toEqual([3]);
  });
});
