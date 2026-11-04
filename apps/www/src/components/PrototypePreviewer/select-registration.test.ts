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

// Select is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. All declare initialRuntime="wc". base exposes a three-runtime
// selector (no vue2); bootstrap and liquid-glass expose a four-runtime selector
// (including vue2); shadcn and brutalist declare only initialRuntime.
// base/shadcn/bootstrap/liquid-glass use `select.mdx`; brutalist publishes at
// `components/select.mdx`. base has no manifest entry (non-manifest guard); the
// other four are manifest-bound. Every family's MDX demoId matches its recipe id.
const SELECT_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'select.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/select',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'select.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/select',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/select.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/select',
    manifestBound: true,
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'select.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/bootstrap-2-3-2/select',
    manifestBound: true,
  },
  {
    family: 'liquid-glass',
    mdxPath: 'select.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/liquid-glass/select',
    manifestBound: true,
  },
] as const;

describe('Select actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of SELECT_FAMILIES) {
    it(`${family} loads only real family select atoms`, async () => {
      const recipeId = `demo-${family}-select`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'select',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.select.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the select demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-select"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} select in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
