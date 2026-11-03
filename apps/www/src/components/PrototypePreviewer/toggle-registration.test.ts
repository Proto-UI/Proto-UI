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

// Toggle is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. All declare initialRuntime="wc". base exposes a three-runtime
// selector (no vue2); bootstrap exposes a four-runtime selector (including
// vue2); liquid-glass renders four separate single-runtime preview blocks (wc,
// react, vue, vue2); shadcn and brutalist declare only initialRuntime.
// base/shadcn/bootstrap/liquid-glass use `toggle.mdx`; brutalist publishes at
// `components/toggle.mdx`. base has no manifest entry, so its id set is asserted
// exactly against the published atom role; the other four are manifest-bound.
const TOGGLE_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'toggle.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue']}"],
    sidebarSlug: 'ui-libraries/base/toggle',
    manifestBound: false,
    expectedIds: ['base-toggle'],
  },
  {
    family: 'shadcn',
    mdxPath: 'toggle.mdx',
    runtimes: [],
    sidebarSlug: 'ui-libraries/shadcn/toggle',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/toggle.mdx',
    runtimes: [],
    sidebarSlug: 'ui-libraries/brutalist/components/toggle',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'toggle.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: 'ui-libraries/bootstrap-2-3-2/toggle',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'liquid-glass',
    mdxPath: 'toggle.mdx',
    runtimes: [
      "runtimes={['wc']}",
      "runtimes={['react']}",
      "runtimes={['vue']}",
      "runtimes={['vue2']}",
    ],
    sidebarSlug: 'ui-libraries/liquid-glass/toggle',
    manifestBound: true,
    expectedIds: null,
  },
] as const;

describe('Toggle actual DemoSpec registration', () => {
  for (const {
    family,
    mdxPath,
    runtimes,
    sidebarSlug,
    manifestBound,
    expectedIds,
  } of TOGGLE_FAMILIES) {
    it(`${family} loads only real family toggle atoms`, async () => {
      const recipeId = `demo-${family}-toggle`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'toggle',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.toggle.recipePrototypeIds].sort()
        ).toEqual(ids);
      } else {
        expect(ids).toEqual([...(expectedIds as string[])].sort());
      }
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the toggle demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-toggle"`);
        expect(source).toContain('initialRuntime="wc"');
        for (const runtime of runtimes) {
          expect(source).toContain(runtime);
        }
      });
    }

    if (sidebarSlug) {
      it(`lists ${family} toggle in the sidebar`, () => {
        const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
        expect(config).toContain(`slug: '${sidebarSlug}'`);
      });
    }
  }
});
