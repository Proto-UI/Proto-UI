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

// Separator is published for base, shadcn, brutalist, and bootstrap-2-3-2. All
// four declare initialRuntime="wc". base additionally exposes a three-runtime
// selector (no vue2); bootstrap a four-runtime selector; shadcn/brutalist declare
// only initialRuntime. base/shadcn/bootstrap use a plain `separator.mdx`;
// brutalist publishes at `components/separator.mdx`. base has no manifest entry,
// so its id list is not manifest-bound.
const SEPARATOR_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'separator.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/separator',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'separator.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/separator',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/separator.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/separator',
    manifestBound: true,
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'separator.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/bootstrap-2-3-2/separator',
    manifestBound: true,
  },
] as const;

describe('Separator actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of SEPARATOR_FAMILIES) {
    it(`${family} loads only real family separator atoms`, async () => {
      const recipeId = `demo-${family}-separator`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'separator',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.separator.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the separator demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-separator"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} separator in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
