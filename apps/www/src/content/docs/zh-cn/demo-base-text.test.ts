// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { textRoot } from '@proto.ui/prototypes-base/text';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-text.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/text.mdx');

describe('Base Text documentation registration', () => {
  it('loads the actual public Base Text prototype lazily', async () => {
    expect(prototypeModules['base-text-root']).toBeTypeOf('function');
    await loadPrototype('base-text-root');
    expect(getPrototype('base-text-root')).toBe(textRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers the text demo on the %s page with the four-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-text');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      expect(text).toContain('@proto.ui/prototypes-base/text');
    }
  );
  it('admits the generated text atom recipe with four text cases', () => {
    const recipe = (recipes['./demo-base-text.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Text recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('box');
    const countProto = (node: any, prototypeId: string): number => {
      if (!node || typeof node !== 'object') return 0;
      let count = node.kind === 'proto' && node.prototypeId === prototypeId ? 1 : 0;
      for (const child of node.children ?? []) count += countProto(child, prototypeId);
      return count;
    };
    expect(countProto(root, 'base-text-root')).toBe(4);
  });
});
