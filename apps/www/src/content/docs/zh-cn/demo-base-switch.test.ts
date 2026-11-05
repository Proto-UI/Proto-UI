// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { switchRoot, switchThumb } from '@proto.ui/prototypes-base/switch';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-switch.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/switch.mdx');

// P-BASE-SWITCH: the demo composes two base-switch-root prototypes (unchecked
// and checked), each owning a base-switch-thumb and an sr-only label.
describe('Base Switch documentation registration', () => {
  it('loads the actual public Base Switch root and thumb prototypes lazily', async () => {
    expect(prototypeModules['base-switch-root']).toBeTypeOf('function');
    await loadPrototype('base-switch-root');
    expect(getPrototype('base-switch-root')).toBe(switchRoot);
    await loadPrototype('base-switch-thumb');
    expect(getPrototype('base-switch-thumb')).toBe(switchThumb);
  });
  it.each(['en', 'zh-cn'])(
    'registers the switch demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-switch');
      expect(text).toContain('base-switch-root');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Switch discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/switch'");
  });
  it('admits a Base-only declarative recipe with two roots and one thumb each', () => {
    const recipe = (recipes['./demo-base-switch.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Switch recipe is missing.');
    assertDemoSpec(recipe);
    const countThumbsIn = (node: any): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === 'base-switch-thumb' ? 1 : 0;
      for (const child of node.children ?? []) count += countThumbsIn(child);
      return count;
    };
    const rootThumbCounts: number[] = [];
    const collectRoots = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-switch-root')
        rootThumbCounts.push(countThumbsIn(node));
      for (const child of node.children ?? []) collectRoots(child);
    };
    collectRoots((recipe as any).root);
    expect(rootThumbCounts).toEqual([1, 1]);
  });
});
