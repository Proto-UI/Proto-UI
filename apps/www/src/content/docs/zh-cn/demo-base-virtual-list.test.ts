// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  virtualListRoot,
  virtualListViewport,
  virtualListContent,
} from '@proto.ui/prototypes-base/virtual-list';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-virtual-list.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/virtual-list.mdx');

describe('Base Virtual List documentation registration', () => {
  it('loads the actual public Base Virtual List root, viewport, and content prototypes lazily', async () => {
    for (const protoId of [
      'base-virtual-list-root',
      'base-virtual-list-viewport',
      'base-virtual-list-content',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-virtual-list-root')).toBe(virtualListRoot);
    expect(getPrototype('base-virtual-list-viewport')).toBe(virtualListViewport);
    expect(getPrototype('base-virtual-list-content')).toBe(virtualListContent);
  });
  it.each(['en', 'zh-cn'])(
    'registers the virtual-list demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-virtual-list');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Virtual List discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/virtual-list'");
  });
  it('admits a Base-only declarative recipe with a root→viewport→content chain', () => {
    const recipe = (
      recipes['./demo-base-virtual-list.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Virtual List recipe is missing.');
    assertDemoSpec(recipe);
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-virtual-list-root') {
        rootCount += 1;
        const viewports = (node.children ?? []).filter(
          (child: any) =>
            child && child.kind === 'proto' && child.prototypeId === 'base-virtual-list-viewport'
        );
        expect(viewports.length).toBe(1);
        const contents = (viewports[0].children ?? []).filter(
          (child: any) =>
            child && child.kind === 'proto' && child.prototypeId === 'base-virtual-list-content'
        );
        expect(contents.length).toBe(1);
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
