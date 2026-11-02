// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  tooltipGroup,
  tooltipRoot,
  tooltipTrigger,
  tooltipContent,
} from '@proto.ui/prototypes-base/tooltip';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-tooltip.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/tooltip.mdx');

describe('Base Tooltip documentation registration', () => {
  it('loads the actual public Base Tooltip group, root, trigger, and content lazily', async () => {
    expect(prototypeModules['base-tooltip-group']).toBeTypeOf('function');
    await loadPrototype('base-tooltip-group');
    expect(getPrototype('base-tooltip-group')).toBe(tooltipGroup);
    await loadPrototype('base-tooltip-root');
    expect(getPrototype('base-tooltip-root')).toBe(tooltipRoot);
    await loadPrototype('base-tooltip-trigger');
    expect(getPrototype('base-tooltip-trigger')).toBe(tooltipTrigger);
    await loadPrototype('base-tooltip-content');
    expect(getPrototype('base-tooltip-content')).toBe(tooltipContent);
  });
  it.each(['en', 'zh-cn'])(
    'registers the tooltip demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-tooltip');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Tooltip discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/tooltip'");
  });
  it('admits a Base-only declarative recipe: one group owning two roots, each with one trigger and one content', () => {
    const recipe = (recipes['./demo-base-tooltip.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Tooltip recipe is missing.');
    assertDemoSpec(recipe);
    const group = (recipe as any).root;
    expect(group.kind).toBe('proto');
    expect(group.prototypeId).toBe('base-tooltip-group');
    const countChildrenIn = (node: any, prototypeId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === prototypeId ? 1 : 0;
      for (const child of node.children ?? []) count += countChildrenIn(child, prototypeId);
      return count;
    };
    const triggerCounts: number[] = [];
    const contentCounts: number[] = [];
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-tooltip-root') {
        triggerCounts.push(countChildrenIn(node, 'base-tooltip-trigger'));
        contentCounts.push(countChildrenIn(node, 'base-tooltip-content'));
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots(group);
    expect(triggerCounts).toEqual([1, 1]);
    expect(contentCounts).toEqual([1, 1]);
  });
});
