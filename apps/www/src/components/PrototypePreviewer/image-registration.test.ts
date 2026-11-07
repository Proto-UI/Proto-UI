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

// Image has no projection-manifest entry for shadcn, so the demo only needs
// real, loadable prototypes under the non-manifest guard.
describe('Image actual DemoSpec registration', () => {
  it('shadcn loads only real family image atoms', async () => {
    const demo = await loadDemo('demo-shadcn-image');
    expect(() => assertDemoSpec(demo)).not.toThrow();
    const ids = [...new Set(prototypes(demo.root))].sort();
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      await loadPrototype(id);
      expect(getPrototype(id)?.name).toBe(id);
    }
  }, 30000);

  for (const locale of ['en', 'zh-cn'] as const) {
    it(`${locale}/shadcn exposes the image demo with its declared runtime`, () => {
      const source = readFileSync(
        `apps/www/src/content/docs/${locale}/ui-libraries/shadcn/image.mdx`,
        'utf8'
      );
      expect(source).toContain('demoId="demo-shadcn-image"');
      expect(source).toContain('initialRuntime="wc"');
      expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
    });
  }

  it('lists shadcn image in the sidebar', () => {
    const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
    expect(config).toContain("slug: 'ui-libraries/shadcn/image'");
  });
});
