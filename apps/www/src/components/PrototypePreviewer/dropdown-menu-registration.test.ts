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

// Dropdown menu is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. All declare initialRuntime="wc". base exposes a three-runtime
// selector (no vue2); bootstrap and liquid-glass expose a four-runtime selector
// (including vue2); shadcn renders three previews (menu, destructive, inset)
// with no combined runtimes array; brutalist declares only initialRuntime.
// base/shadcn/bootstrap/liquid-glass use `dropdown-menu.mdx`; brutalist publishes
// at `components/dropdown-menu.mdx`. base and bootstrap have no manifest entry
// (non-manifest guard); shadcn, brutalist, and liquid-glass are manifest-bound.
// Every family's MDX demoId matches its recipe id.
const DROPDOWN_MENU_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'dropdown-menu.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/dropdown-menu',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'dropdown-menu.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/dropdown-menu',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/dropdown-menu.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/dropdown-menu',
    manifestBound: true,
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'dropdown-menu.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/bootstrap-2-3-2/dropdown-menu',
    manifestBound: false,
  },
  {
    family: 'liquid-glass',
    mdxPath: 'dropdown-menu.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/liquid-glass/dropdown-menu',
    manifestBound: true,
  },
] as const;

describe('Dropdown menu actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of DROPDOWN_MENU_FAMILIES) {
    it(`${family} loads only real family dropdown menu atoms`, async () => {
      const recipeId = `demo-${family}-dropdown-menu`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'dropdown-menu',
        });
        expect(
          [
            ...PROJECTION_FAMILY_MANIFESTS[family].families['dropdown-menu'].recipePrototypeIds,
          ].sort()
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
      it(`${locale}/${family} exposes the dropdown menu demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-dropdown-menu"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} dropdown menu in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
