import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';
import { PROJECTION_FAMILY_MANIFESTS, resolveProjectionRecipe } from './projection-families';

function prototypes(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(prototypes),
  ];
}

// Shadcn has no projection-manifest entry for async region, so its demo only
// needs real, loadable prototypes under the non-manifest guard. The Brutalist
// family declares a manifest entry: recipe prototype ids must resolve exactly
// through demo-brutalist-async-region, including the auxiliary family Button
// that drives the real busy prop.
const ASYNC_REGION_FAMILIES = [
  {
    family: 'shadcn',
    mdxPath: 'async-region.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/shadcn/async-region',
    manifestBound: false,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/async-region.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/async-region',
    manifestBound: true,
  },
] as const;

describe('Async region actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of ASYNC_REGION_FAMILIES) {
    it(`${family} loads only real family async region atoms`, async () => {
      const recipeId = `demo-${family}-async-region`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'async-region',
        });
        expect(
          [
            ...PROJECTION_FAMILY_MANIFESTS[family].families['async-region'].recipePrototypeIds,
          ].sort()
        ).toEqual(ids);
      } else {
        expect(ids.length).toBeGreaterThan(0);
      }
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the async region demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-async-region"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} async region in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
