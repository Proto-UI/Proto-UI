// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  resizableRoot,
  resizablePanel,
  resizableHandle,
} from '@proto.ui/prototypes-base/resizable';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-resizable.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/resizable.mdx');

describe('Base Resizable documentation registration', () => {
  it('loads the actual public Base Resizable root, panel, and handle prototypes lazily', async () => {
    for (const protoId of [
      'base-resizable-root',
      'base-resizable-panel',
      'base-resizable-handle',
    ]) {
      expect(prototypeModules[protoId]).toBeTypeOf('function');
      await loadPrototype(protoId);
    }
    expect(getPrototype('base-resizable-root')).toBe(resizableRoot);
    expect(getPrototype('base-resizable-panel')).toBe(resizablePanel);
    expect(getPrototype('base-resizable-handle')).toBe(resizableHandle);
  });
  it.each(['en', 'zh-cn'])(
    'registers the resizable demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-resizable');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    }
  );
  it('makes Base Resizable discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/resizable'");
  });
  it('admits a Base-only declarative recipe with one root, two panels, and a single handle', () => {
    const recipe = (recipes['./demo-base-resizable.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Resizable recipe is missing.');
    assertDemoSpec(recipe);
    const countIn = (node: any, protoId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === protoId ? 1 : 0;
      for (const child of node.children ?? []) count += countIn(child, protoId);
      return count;
    };
    let rootCount = 0;
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-resizable-root') {
        rootCount += 1;
        expect(countIn(node, 'base-resizable-panel')).toBe(2);
        expect(countIn(node, 'base-resizable-handle')).toBe(1);
      }
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootCount).toBe(1);
  });
});
