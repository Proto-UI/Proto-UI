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

// Scroll area is published for base, shadcn, and brutalist. All three declare
// initialRuntime="wc"; base additionally exposes a three-runtime selector (no
// vue2). base/shadcn use a plain `scroll-area.mdx`; brutalist publishes at
// `components/scroll-area.mdx`. Unlike the other atoms, shadcn has no
// projection-manifest entry here, so both base and shadcn use the non-manifest
// guard; only brutalist is manifest-bound.
const SCROLL_AREA_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'scroll-area.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/scroll-area',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'scroll-area.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/scroll-area',
    manifestBound: false,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/scroll-area.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/scroll-area',
    manifestBound: true,
  },
] as const;

describe('Scroll area actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of SCROLL_AREA_FAMILIES) {
    it(`${family} loads only real family scroll area atoms`, async () => {
      const recipeId = `demo-${family}-scroll-area`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'scroll-area',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families['scroll-area'].recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the scroll area demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-scroll-area"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} scroll area in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
