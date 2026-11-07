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

// Shadcn has no projection-manifest entry for live region, so its demo only
// needs real, loadable prototypes under the non-manifest guard. The Brutalist
// family declares a manifest entry: recipe prototype ids must resolve exactly
// through demo-brutalist-live-region, including the auxiliary family Button
// that pushes authored payload mutations.
const LIVE_REGION_FAMILIES = [
  {
    family: 'shadcn',
    mdxPath: 'live-region.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/shadcn/live-region',
    manifestBound: false,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/live-region.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/live-region',
    manifestBound: true,
  },
] as const;

describe('Live region actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of LIVE_REGION_FAMILIES) {
    it(`${family} loads only real family live region atoms`, async () => {
      const recipeId = `demo-${family}-live-region`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'live-region',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families['live-region'].recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the live region demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-live-region"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} live region in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
