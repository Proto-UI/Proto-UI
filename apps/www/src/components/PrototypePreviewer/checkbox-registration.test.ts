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

// Checkbox is published for base, shadcn, brutalist, and bootstrap-2-3-2. All
// four declare the demo with initialRuntime="wc". base additionally exposes a
// single-runtime selector (wc only); bootstrap a four-runtime selector;
// shadcn/brutalist declare only initialRuntime. base/shadcn/bootstrap use a plain
// `checkbox.mdx`; brutalist publishes at `components/checkbox.mdx`. base has no
// manifest entry, so its id list is not manifest-bound.
const CHECKBOX_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'checkbox.mdx',
    runtimes: "runtimes={['wc']}",
    slug: 'ui-libraries/base/checkbox',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'checkbox.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/checkbox',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/checkbox.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/checkbox',
    manifestBound: true,
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'checkbox.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/bootstrap-2-3-2/checkbox',
    manifestBound: true,
  },
] as const;

describe('Checkbox actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of CHECKBOX_FAMILIES) {
    it(`${family} loads only real family checkbox atoms`, async () => {
      const recipeId = `demo-${family}-checkbox`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'checkbox',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.checkbox.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the checkbox demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-checkbox"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} checkbox in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
