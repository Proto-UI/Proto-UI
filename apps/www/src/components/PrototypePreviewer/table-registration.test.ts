import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';

function prototypes(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(prototypes),
  ];
}

// Table is published for the base family only. It declares initialRuntime="wc"
// and a four-runtime selector (including vue2). base has no projection
// manifest entry, so the demo's atom id set is asserted exactly against the
// published table roles.
describe('Table actual DemoSpec registration', () => {
  it('base loads only real family table atoms', async () => {
    const recipeId = 'demo-base-table';
    const demo = await loadDemo(recipeId);
    expect(() => assertDemoSpec(demo)).not.toThrow();
    const ids = [...new Set(prototypes(demo.root))].sort();
    expect(ids).toEqual([
      'base-table-caption',
      'base-table-cell',
      'base-table-header-cell',
      'base-table-root',
      'base-table-row',
    ]);
    for (const id of ids) {
      await loadPrototype(id);
      expect(getPrototype(id)?.name).toBe(id);
    }
  }, 30000);

  for (const locale of ['en', 'zh-cn'] as const) {
    it(`${locale}/base exposes the table demo with its declared runtime`, () => {
      const source = readFileSync(
        `apps/www/src/content/docs/${locale}/ui-libraries/base/table.mdx`,
        'utf8'
      );
      expect(source).toContain('demoId="demo-base-table"');
      expect(source).toContain('initialRuntime="wc"');
      expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    });
  }

  it('lists base table in the sidebar', () => {
    const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
    expect(config).toContain("slug: 'ui-libraries/base/table'");
  });
});
