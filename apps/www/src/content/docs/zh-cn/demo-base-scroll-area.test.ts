// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { scrollAreaRoot, scrollAreaViewport } from '@proto.ui/prototypes-base/scroll-area';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-scroll-area.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/scroll-area.mdx');

describe('Base Scroll Area documentation registration', () => {
  it('loads the actual public Base Scroll Area root and viewport prototypes lazily', async () => {
    expect(prototypeModules['base-scroll-area-root']).toBeTypeOf('function');
    await loadPrototype('base-scroll-area-root');
    expect(getPrototype('base-scroll-area-root')).toBe(scrollAreaRoot);
    await loadPrototype('base-scroll-area-viewport');
    expect(getPrototype('base-scroll-area-viewport')).toBe(scrollAreaViewport);
  });
  it.each(['en', 'zh-cn'])(
    'registers the scroll-area demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-scroll-area');
      expect(text).toContain('@proto.ui/prototypes-base/scroll-area');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Scroll Area discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/scroll-area'");
  });
  it('admits a Base-only declarative recipe with two roots each owning one viewport', () => {
    const recipe = (
      recipes['./demo-base-scroll-area.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Scroll Area recipe is missing.');
    assertDemoSpec(recipe);
    const countViewportsIn = (node: any): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === 'base-scroll-area-viewport' ? 1 : 0;
      for (const child of node.children ?? []) count += countViewportsIn(child);
      return count;
    };
    const rootViewportCounts: number[] = [];
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-scroll-area-root')
        rootViewportCounts.push(countViewportsIn(node));
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootViewportCounts).toEqual([1, 1]);
  });
});
