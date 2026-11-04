// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { labelRoot } from '@proto.ui/prototypes-base/label';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-label.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/label.mdx');

describe('Base Label documentation registration', () => {
  it('loads the actual public Base Label prototype lazily', async () => {
    expect(prototypeModules['base-label-root']).toBeTypeOf('function');
    await loadPrototype('base-label-root');
    expect(getPrototype('base-label-root')).toBe(labelRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers the label demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-label');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      expect(text).toContain('@proto.ui/prototypes-base/label');
    }
  );
  it('makes Base Label discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/label'");
  });
  it('admits the generated control-label recipe with nine associated labels', () => {
    const recipe = (recipes['./demo-base-label.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Label recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('box');
    const countProto = (node: any, prototypeId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === prototypeId ? 1 : 0;
      for (const child of node.children ?? []) count += countProto(child, prototypeId);
      return count;
    };
    expect(countProto(root, 'base-label-root')).toBe(9);
  });
});
