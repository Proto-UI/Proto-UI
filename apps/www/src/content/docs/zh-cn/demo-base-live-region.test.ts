// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import liveRegionRoot from '@proto.ui/prototypes-base/live-region';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-live-region.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/live-region.mdx');

// P-BASE-LIVE-REGION: a narrow async accessibility primitive that projects
// governed ARIA live-region semantics without declaring an interaction path.
describe('Base Live Region documentation registration', () => {
  it('loads the actual public Base Live Region prototype lazily', async () => {
    expect(prototypeModules['base-live-region-root']).toBeTypeOf('function');
    await loadPrototype('base-live-region-root');
    expect(getPrototype('base-live-region-root')).toBe(liveRegionRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers the live region demo on the %s page with the WC initial runtime and no runtime promotion',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-live-region');
      expect(text).toContain('base-live-region-root');
      expect(text).toContain('initialRuntime="wc"');
    }
  );
  it('makes Base Live Region discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/live-region'");
  });
  it('admits a Base-only declarative recipe with a single live region root and no children of its own', () => {
    const recipe = (
      recipes['./demo-base-live-region.demo.ts'] as { default?: DemoSpec } | undefined
    )?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Live Region recipe is missing.');
    assertDemoSpec(recipe);
    const roots: string[] = [];
    const nested: string[] = [];
    const visit = (node: any, underRoot: boolean) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto') {
        if (node.prototypeId === 'base-live-region-root') roots.push(node.prototypeId);
        else if (underRoot) nested.push(node.prototypeId);
      }
      const inRoot = underRoot || node.prototypeId === 'base-live-region-root';
      for (const child of node.children ?? []) visit(child, inRoot);
    };
    visit((recipe as any).root, false);
    expect(roots).toEqual(['base-live-region-root']);
    expect(nested).toEqual([]);
  });
});
