// @vitest-environment happy-dom
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import separatorRoot from '@proto.ui/prototypes-base/separator';
import {
  loadPrototype,
  prototypeModules,
} from '../../../components/PrototypePreviewer/prototype-modules';
import { getPrototype } from '../../../components/PrototypePreviewer/registry';
import { assertDemoSpec, type DemoSpec } from '../../../components/PrototypePreviewer/demo-types';

const recipes = import.meta.glob('./demo-base-separator.demo.ts', { eager: true });
const docs = (locale: string) =>
  resolve(process.cwd(), 'apps/www/src/content/docs', locale, 'ui-libraries/base/separator.mdx');

// P-BASE-SEPARATOR: a passive divider; the demo shows a horizontal and a
// vertical (non-decorative) separator.
describe('Base Separator documentation registration', () => {
  it('loads the actual public Base Separator prototype lazily', async () => {
    expect(prototypeModules['base-separator-root']).toBeTypeOf('function');
    await loadPrototype('base-separator-root');
    expect(getPrototype('base-separator-root')).toBe(separatorRoot);
  });
  it.each(['en', 'zh-cn'])(
    'registers the separator demo on the %s page with the three-runtime scope',
    (locale) => {
      const path = docs(locale);
      expect(existsSync(path)).toBe(true);
      const text = readFileSync(path, 'utf8');
      expect(text).toContain('demo-base-separator');
      expect(text).toContain('separatorRoot');
      expect(text).toContain("runtimes={['wc', 'react', 'vue']}");
    }
  );
  it('makes Base Separator discoverable in the sidebar', () => {
    const config = readFileSync(resolve(process.cwd(), 'apps/www/astro.config.mjs'), 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/separator'");
  });
  it('admits a Base-only declarative recipe with a horizontal and a vertical separator', () => {
    const recipe = (recipes['./demo-base-separator.demo.ts'] as { default?: DemoSpec } | undefined)
      ?.default;
    expect(recipe).toBeDefined();
    if (!recipe) throw new Error('The actual Base Separator recipe is missing.');
    assertDemoSpec(recipe);
    const separators: Array<{ orientation?: string; decorative?: boolean }> = [];
    const visit = (node: any) => {
      if (!node || typeof node !== 'object') return;
      if (node.kind === 'proto' && node.prototypeId === 'base-separator-root')
        separators.push(node.props ?? {});
      for (const child of node.children ?? []) visit(child);
    };
    visit((recipe as any).root);
    expect(separators).toHaveLength(2);
    expect(separators.some((s) => s.orientation === 'vertical' && s.decorative === false)).toBe(
      true
    );
    expect(separators.some((s) => s.orientation === undefined)).toBe(true);
  });
});
