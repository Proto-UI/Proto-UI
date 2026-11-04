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

// Tooltip is published for base, shadcn, and brutalist. base and brutalist each
// declare initialRuntime="wc" plus a three-runtime selector (no vue2); shadcn
// declares only initialRuntime. base/shadcn use a plain `tooltip.mdx`; brutalist
// publishes at `components/tooltip.mdx`. base and shadcn have no manifest entry,
// so both use the non-manifest guard; only brutalist is manifest-bound.
const TOOLTIP_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'tooltip.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/tooltip',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'tooltip.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/tooltip',
    manifestBound: false,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/tooltip.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/brutalist/components/tooltip',
    manifestBound: true,
  },
] as const;

describe('Tooltip actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of TOOLTIP_FAMILIES) {
    it(`${family} loads only real family tooltip atoms`, async () => {
      const recipeId = `demo-${family}-tooltip`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'tooltip',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.tooltip.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the tooltip demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-tooltip"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} tooltip in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
