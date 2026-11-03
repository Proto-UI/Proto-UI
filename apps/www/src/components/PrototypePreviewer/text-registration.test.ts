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

// Text is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). base/shadcn/bootstrap/liquid-glass use `text.mdx`;
// brutalist publishes at `components/text.mdx`. base, shadcn, and brutalist have
// no manifest entry, so their id sets are asserted exactly against the
// published atom role; bootstrap-2-3-2 and liquid-glass are manifest-bound.
//
// The docs navigation links only the bootstrap-2-3-2 and liquid-glass text
// pages, so `sidebarSlug` is null for the other three: a published page is not
// required to appear in the sidebar — the merged accordion registration test
// asserts no sidebar entry for any of its five published families either.
const TEXT_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'text.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: false,
    expectedIds: ['base-text-root'],
  },
  {
    family: 'shadcn',
    mdxPath: 'text.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: false,
    expectedIds: ['shadcn-text-root'],
  },
  {
    family: 'brutalist',
    mdxPath: 'components/text.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: false,
    expectedIds: ['brutalist-text-root'],
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'text.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: 'ui-libraries/bootstrap-2-3-2/text',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'liquid-glass',
    mdxPath: 'text.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: 'ui-libraries/liquid-glass/text',
    manifestBound: true,
    expectedIds: null,
  },
] as const;

describe('Text actual DemoSpec registration', () => {
  for (const {
    family,
    mdxPath,
    runtimes,
    sidebarSlug,
    manifestBound,
    expectedIds,
  } of TEXT_FAMILIES) {
    it(`${family} loads only real family text atoms`, async () => {
      const recipeId = `demo-${family}-text`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'text',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.text.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the text demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-text"`);
        expect(source).toContain('initialRuntime="wc"');
        for (const runtime of runtimes) {
          expect(source).toContain(runtime);
        }
      });
    }

    if (sidebarSlug) {
      it(`lists ${family} text in the sidebar`, () => {
        const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
        expect(config).toContain(`slug: '${sidebarSlug}'`);
      });
    }
  }
});
