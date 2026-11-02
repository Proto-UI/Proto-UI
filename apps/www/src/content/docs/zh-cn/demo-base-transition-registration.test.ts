// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import transition from '../../../../../../packages/prototypes/base/src/transition/transition.proto';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-transition-command.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/transition.mdx');

describe('Base Transition documentation registration', () => {
  it('loads the actual public Base Transition prototype lazily', async () => {
    expect(prototypeModules['base-transition']).toBeTypeOf('function');
    await loadPrototype('base-transition');
    expect(getPrototype('base-transition')).toBe(transition);
  });
  it.each(['en', 'zh-cn'])(
    'registers the transition demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-transition-command');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Transition discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/transition'");
  });
  it('admits a Base-only transition recipe with one transition root in a box tree', () => {
    const recipe = (
      recipes['./demo-base-transition-command.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Transition recipe is missing.');
    assertDemoSpec(recipe);
    let transitionCount = 0;
    const collect = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-transition') transitionCount += 1;
      for (const child of node.children ?? []) collect(child);
    };
    collect((recipe as any).root);
    expect(transitionCount).toBe(1);
  });
});
