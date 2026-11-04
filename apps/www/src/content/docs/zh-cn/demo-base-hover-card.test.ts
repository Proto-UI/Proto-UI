// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hoverCardRoot,
  hoverCardTrigger,
  hoverCardContent,
} from '@proto.ui/prototypes-base/hover-card';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-hover-card.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/hover-card.mdx');

describe('Base Hover Card documentation registration', () => {
  it('loads the actual public Base Hover Card root, trigger, and content lazily', async () => {
    expect(prototypeModules['base-hover-card-root']).toBeTypeOf('function');
    await loadPrototype('base-hover-card-root');
    expect(getPrototype('base-hover-card-root')).toBe(hoverCardRoot);
    await loadPrototype('base-hover-card-trigger');
    expect(getPrototype('base-hover-card-trigger')).toBe(hoverCardTrigger);
    await loadPrototype('base-hover-card-content');
    expect(getPrototype('base-hover-card-content')).toBe(hoverCardContent);
  });
  it.each(['en', 'zh-cn'])(
    'registers the hover-card demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-hover-card');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Hover Card discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/hover-card'");
  });
  it('admits a Base-only declarative recipe with one root owning one trigger and one content', () => {
    const recipe = (recipes['./demo-base-hover-card.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Hover Card recipe is missing.');
    assertDemoSpec(recipe);
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
      if (node.kind === 'proto' && node.prototypeId === 'base-hover-card-root') {
        triggerCounts.push(countChildrenIn(node, 'base-hover-card-trigger'));
        contentCounts.push(countChildrenIn(node, 'base-hover-card-content'));
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(triggerCounts).toEqual([1]);
    expect(contentCounts).toEqual([1]);
  });
});
