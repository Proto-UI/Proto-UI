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

// Surface is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). base/shadcn/bootstrap/liquid-glass use
// `surface.mdx`; brutalist publishes at `components/surface.mdx`. base and
// brutalist have no manifest entry, so their id sets are asserted exactly
// against the published atom role; shadcn, bootstrap-2-3-2, and liquid-glass
// are manifest-bound.
//
// No surface page appears in the docs navigation for any family, so
// `sidebarSlug` is null throughout: a published page is not required to appear
// in the sidebar — the merged accordion registration test asserts no sidebar
// entry for any of its five published families either. The MDX scope stays
// asserted for every family, so each page and its demo wiring remain covered.
const SURFACE_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'surface.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: false,
    expectedIds: ['base-surface-root'],
  },
  {
    family: 'shadcn',
    mdxPath: 'surface.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/surface.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: false,
    expectedIds: ['brutalist-surface-root'],
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'surface.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'liquid-glass',
    mdxPath: 'surface.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: true,
    expectedIds: null,
  },
] as const;

describe('Surface actual DemoSpec registration', () => {
  for (const {
    family,
    mdxPath,
    runtimes,
    sidebarSlug,
    manifestBound,
    expectedIds,
  } of SURFACE_FAMILIES) {
    it(`${family} loads only real family surface atoms`, async () => {
      const recipeId = `demo-${family}-surface`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'surface',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.surface.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the surface demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-surface"`);
        expect(source).toContain('initialRuntime="wc"');
        for (const runtime of runtimes) {
          expect(source).toContain(runtime);
        }
      });
    }

    if (sidebarSlug) {
      it(`lists ${family} surface in the sidebar`, () => {
        const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
        expect(config).toContain(`slug: '${sidebarSlug}'`);
      });
    }
  }
});
