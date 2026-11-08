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

// Table has no projection-manifest entry for shadcn, so the demo only needs
// real, loadable prototypes under the non-manifest guard. The shared factory
// still guarantees the five-part Base anatomy per demo instance.
describe('Table actual DemoSpec registration', () => {
  it('shadcn loads only real family table atoms', async () => {
    const demo = await loadDemo('demo-shadcn-table');
    expect(() => assertDemoSpec(demo)).not.toThrow();
    const ids = [...new Set(prototypes(demo.root))].sort();
    expect(ids).toEqual([
      'shadcn-style-scope',
      'shadcn-table-caption',
      'shadcn-table-cell',
      'shadcn-table-header-cell',
      'shadcn-table-root',
      'shadcn-table-row',
    ]);
    for (const id of ids) {
      await loadPrototype(id);
      expect(getPrototype(id)?.name).toBe(id);
    }
  }, 30000);

  for (const locale of ['en', 'zh-cn'] as const) {
    it(`${locale}/shadcn exposes the table demo with its declared runtime`, () => {
      const source = readFileSync(
        `apps/www/src/content/docs/${locale}/ui-libraries/shadcn/table.mdx`,
        'utf8'
      );
      expect(source).toContain('demoId="demo-shadcn-table"');
      expect(source).toContain('initialRuntime="wc"');
      expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    });
  }

  it('lists shadcn table in the sidebar', () => {
    const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
    expect(config).toContain("slug: 'ui-libraries/shadcn/table'");
  });

  it('brutalist loads only real family table atoms', async () => {
    const demo = await loadDemo('demo-brutalist-table');
    expect(() => assertDemoSpec(demo)).not.toThrow();
    const ids = [...new Set(prototypes(demo.root))].sort();
    expect(ids).toEqual([
      'brutalist-table-caption',
      'brutalist-table-cell',
      'brutalist-table-header-cell',
      'brutalist-table-root',
      'brutalist-table-row',
    ]);
    for (const id of ids) {
      await loadPrototype(id);
      expect(getPrototype(id)?.name).toBe(id);
    }
  }, 30000);

  for (const locale of ['en', 'zh-cn'] as const) {
    it(`${locale}/brutalist exposes the table demo with its declared runtime`, () => {
      const source = readFileSync(
        `apps/www/src/content/docs/${locale}/ui-libraries/brutalist/components/table.mdx`,
        'utf8'
      );
      expect(source).toContain('demoId="demo-brutalist-table"');
      expect(source).toContain('initialRuntime="wc"');
      expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    });
  }

  it('lists brutalist table in the sidebar', () => {
    const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
    expect(config).toContain("slug: 'ui-libraries/brutalist/components/table'");
  });
});
