// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { surfaceRoot } from '@proto.ui/prototypes-base/surface';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-surface.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/surface.mdx');

describe('Base Surface documentation registration', () => {
  it('loads the actual public Base Surface prototype lazily', async () => {
    expect(prototypeModules['base-surface-root']).toBeTypeOf('function');
    await loadPrototype('base-surface-root');
    expect(getPrototype('base-surface-root')).toBe(surfaceRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers the surface demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-surface');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      expect(text).toContain('@proto.ui/prototypes-base/surface');
    }
  );
  it('admits the generated surface atom recipe with four surface cases', () => {
    const recipe = (recipes['./demo-base-surface.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Surface recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('box');
    const countProto = (node: any, prototypeId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === prototypeId ? 1 : 0;
      for (const child of node.children ?? []) count += countProto(child, prototypeId);
      return count;
    };
    expect(countProto(root, 'base-surface-root')).toBe(4);
  });
});
