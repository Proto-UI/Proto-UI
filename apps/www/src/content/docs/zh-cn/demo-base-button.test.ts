// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { button } from '@proto.ui/prototypes-base/button';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-button.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/button.mdx');

describe('Base Button documentation registration', () => {
  it('loads the actual public Base Button prototype lazily', async () => {
    expect(prototypeModules['base-button']).toBeTypeOf('function');
    await loadPrototype('base-button');
    expect(getPrototype('base-button')).toBe(button);
  });
  it.each(['en', 'zh-cn'])(
    'registers the button demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-button');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Button discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/button'");
  });
  it('admits a Base-only declarative recipe with exactly two button protos', () => {
    const recipe = (recipes['./demo-base-button.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Button recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('box');
    let buttonCount = 0;
    const countButtons = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-button') buttonCount += 1;
      for (const child of node.children ?? []) countButtons(child);
    };
    countButtons(root);
    expect(buttonCount).toBe(2);
  });
});
