// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { treeRoot, treeItem, treeToggle } from '@proto.ui/prototypes-base/tree';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-tree.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/tree.mdx');

describe('Base Tree documentation registration', () => {
  it('loads the actual public Base Tree root, item, and toggle prototypes lazily', async () => {
    for (const protoId of ['base-tree-root', 'base-tree-item', 'base-tree-toggle']) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-tree-root')).toBe(treeRoot);
    expect(getPrototype('base-tree-item')).toBe(treeItem);
    expect(getPrototype('base-tree-toggle')).toBe(treeToggle);
  });
  it.each(['en', 'zh-cn'])(
    'registers the tree demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-tree');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Tree discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/tree'");
  });
  it('admits a Base-only declarative recipe with one root holding four items and one toggle', () => {
    const recipe = (recipes['./demo-base-tree.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Tree recipe is missing.');
    assertDemoSpec(recipe);
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-tree-root') {
        rootCount += 1;
        const directProtoChildren = (node.children ?? []).filter(
          (child: any) => child && typeof child === 'object' && child.kind === 'proto'
        );
        const itemCount = directProtoChildren.filter(
          (child: any) => child.prototypeId === 'base-tree-item'
        ).length;
        const toggleCount = directProtoChildren.filter(
          (child: any) => child.prototypeId === 'base-tree-toggle'
        ).length;
        expect(itemCount).toBe(4);
        expect(toggleCount).toBe(1);
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
