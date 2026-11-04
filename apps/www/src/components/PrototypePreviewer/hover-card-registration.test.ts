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

// Hover card is published for base, shadcn, and brutalist. All three declare
// initialRuntime="wc"; base additionally exposes a three-runtime selector (no
// vue2). base/shadcn use a plain `hover-card.mdx`; brutalist publishes at
// `components/hover-card.mdx`. base has no manifest entry, so its id list is not
// manifest-bound; shadcn and brutalist are manifest-bound.
const HOVER_CARD_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'hover-card.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/hover-card',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'hover-card.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/hover-card',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/hover-card.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/hover-card',
    manifestBound: true,
  },
] as const;

describe('Hover card actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of HOVER_CARD_FAMILIES) {
    it(`${family} loads only real family hover card atoms`, async () => {
      const recipeId = `demo-${family}-hover-card`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'hover-card',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families['hover-card'].recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the hover card demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-hover-card"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} hover card in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
