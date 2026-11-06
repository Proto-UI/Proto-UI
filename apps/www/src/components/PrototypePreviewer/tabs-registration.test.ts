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

// Tabs is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. All declare initialRuntime="wc". base exposes a three-runtime
// selector (no vue2); bootstrap and liquid-glass expose a four-runtime selector
// (including vue2); shadcn renders four separate single-runtime preview blocks
// (wc, react, vue, vue2); brutalist declares only initialRuntime.
// base/shadcn/bootstrap/liquid-glass use `tabs.mdx`; brutalist publishes at
// `components/tabs.mdx`. base has no manifest entry, so its id set is asserted
// exactly against the published atom roles; the other four are manifest-bound.
//
// `sidebarSlug` is null for the families the docs navigation does not link
// (bootstrap-2-3-2, liquid-glass): a published page is not required to appear
// in the sidebar — the merged accordion registration test asserts no sidebar
// entry for any of its five published families either. Their MDX scope is still
// asserted, so the page and its demo wiring stay covered.
const TABS_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'tabs.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue']}"],
    sidebarSlug: 'ui-libraries/base/tabs',
    manifestBound: false,
    expectedIds: [
      'base-tabs-content',
      'base-tabs-indicator',
      'base-tabs-list',
      'base-tabs-root',
      'base-tabs-trigger',
    ],
  },
  {
    family: 'shadcn',
    mdxPath: 'tabs.mdx',
    runtimes: [
      "runtimes={['wc']}",
      "runtimes={['react']}",
      "runtimes={['vue']}",
      "runtimes={['vue2']}",
    ],
    sidebarSlug: 'ui-libraries/shadcn/tabs',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/tabs.mdx',
    runtimes: [],
    sidebarSlug: 'ui-libraries/brutalist/components/tabs',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'tabs.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'liquid-glass',
    mdxPath: 'tabs.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: null,
    manifestBound: true,
    expectedIds: null,
  },
] as const;

describe('Tabs actual DemoSpec registration', () => {
  for (const {
    family,
    mdxPath,
    runtimes,
    sidebarSlug,
    manifestBound,
    expectedIds,
  } of TABS_FAMILIES) {
    it(`${family} loads only real family tabs atoms`, async () => {
      const recipeId = `demo-${family}-tabs`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'tabs',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.tabs.recipePrototypeIds].sort()
        ).toEqual(ids);
      } else {
        expect(ids).toEqual([...expectedIds].sort());
      }
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the tabs demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-tabs"`);
        expect(source).toContain('initialRuntime="wc"');
        for (const runtime of runtimes) {
          expect(source).toContain(runtime);
        }
      });
    }

    if (sidebarSlug) {
      it(`lists ${family} tabs in the sidebar`, () => {
        const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
        expect(config).toContain(`slug: '${sidebarSlug}'`);
      });
    }
  }

  const SHADCN_PRESET_DEMOS = [
    { id: 'demo-shadcn-tabs-preset-nova', styleProfile: 'nova' },
    { id: 'demo-shadcn-tabs-preset-rhea', styleProfile: 'rhea' },
    { id: 'demo-shadcn-tabs-preset-new-york-v4', styleProfile: 'new-york-v4' },
  ] as const;

  for (const { id, styleProfile } of SHADCN_PRESET_DEMOS) {
    it(`${id} loads only real shadcn tabs atoms with style scope`, async () => {
      const demo = await loadDemo(id);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual([
        'shadcn-style-scope',
        'shadcn-tabs-content',
        'shadcn-tabs-indicator',
        'shadcn-tabs-list',
        'shadcn-tabs-root',
        'shadcn-tabs-trigger',
      ]);
      for (const atomId of ids) {
        await loadPrototype(atomId);
        expect(getPrototype(atomId)?.name).toBe(atomId);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/shadcn exposes ${id} with declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/shadcn/tabs.mdx`,
          'utf8'
        );
        expect(source).toContain(`demoId="${id}"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc']}");
        expect(source).toContain("runtimes={['react']}");
        expect(source).toContain("runtimes={['vue']}");
        expect(source).toContain("runtimes={['vue2']}");
      });
    }
  }
});
