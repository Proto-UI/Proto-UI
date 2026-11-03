// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import asyncRegionRoot from '@proto.ui/prototypes-base/async-region';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-async-region.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/async-region.mdx');

describe('Base Async Region documentation registration', () => {
  it('loads the actual public Base Async Region root prototype lazily', async () => {
    expect(prototypeModules['base-async-region-root']).toBeTypeOf('function');
    await loadPrototype('base-async-region-root');
    expect(getPrototype('base-async-region-root')).toBe(asyncRegionRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers the async-region demo on the %s page with the web-components runtime',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-async-region');
      expect(text).toContain('base-async-region-root');
      expect(text).toContain('initialRuntime="wc"');
      expect(text).not.toContain('runtimes=');
    }
  );
  it('makes Base Async Region discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/async-region'");
  });
  it('admits a Base-only declarative recipe with a single busy root', () => {
    const recipe = (
      recipes['./demo-base-async-region.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Async Region recipe is missing.');
    assertDemoSpec(recipe);
    const root = (recipe as any).root;
    expect(root.kind).toBe('proto');
    expect(root.prototypeId).toBe('base-async-region-root');
    expect(root.props.busy).toBe(true);
  });
});
