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

// Card is published for shadcn and brutalist only (no base). Both declare the
// demo with initialRuntime="wc" and no runtimes selector. shadcn uses a plain
// `card.mdx`; brutalist publishes at `components/card.mdx`. Both are manifest-bound,
// so each id list is asserted against recipePrototypeIds.
const CARD_FAMILIES = [
  {
    family: 'shadcn',
    mdxPath: 'card.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/card',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/card.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/card',
    manifestBound: true,
  },
] as const;

describe('Card actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of CARD_FAMILIES) {
    it(`${family} loads only real family card atoms`, async () => {
      const recipeId = `demo-${family}-card`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'card',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.card.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the card demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-card"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} card in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
