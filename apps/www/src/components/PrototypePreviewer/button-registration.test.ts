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

// Button is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. All declare initialRuntime="wc". base exposes a three-runtime
// selector (no vue2); bootstrap exposes a four-runtime selector (including vue2);
// shadcn and liquid-glass each render four separate single-runtime preview blocks,
// so they have no combined runtimes array. base/shadcn use `button.mdx`; brutalist
// publishes at `components/button.mdx`. base has no manifest entry (non-manifest
// guard); the other four are manifest-bound. shadcn's MDX is decoupled from the
// recipe: it renders `demo-button` / `demo-button-variants` / `demo-button-*`
// previews rather than the `demo-shadcn-button` recipe id, so its MDX scope
// assertion checks the shared `demo-button` marker instead of the recipe demoId.
const BUTTON_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'button.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/button',
    manifestBound: false,
    mdxDemoId: 'demo-base-button',
  },
  {
    family: 'shadcn',
    mdxPath: 'button.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/button',
    manifestBound: true,
    mdxDemoId: null,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/button.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/button',
    manifestBound: true,
    mdxDemoId: 'demo-brutalist-button',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'button.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/bootstrap-2-3-2/button',
    manifestBound: true,
    mdxDemoId: 'demo-bootstrap-2-3-2-button',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'button.mdx',
    runtimes: null,
    slug: 'ui-libraries/liquid-glass/button',
    manifestBound: true,
    mdxDemoId: 'demo-liquid-glass-button',
  },
] as const;

describe('Button actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound, mdxDemoId } of BUTTON_FAMILIES) {
    it(`${family} loads only real family button atoms`, async () => {
      const recipeId = `demo-${family}-button`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'button',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.button.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the button demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        if (mdxDemoId) {
          expect(source).toContain(`demoId="${mdxDemoId}"`);
        } else {
          expect(source).toContain('demo-button');
        }
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} button in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
