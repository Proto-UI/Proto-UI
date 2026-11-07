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

// Transition has no projection-manifest entry for shadcn, so that demo only
// needs real, loadable prototypes under the non-manifest guard. The Brutalist
// family binds its published atoms to the manifest, so its id list is
// manifest-bound. Each family declares its own mdx path and slug: shadcn uses
// a plain page under ui-libraries/shadcn, brutalist uses components/.
const TRANSITION_FAMILIES = [
  {
    family: 'shadcn',
    mdxPath: 'transition.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/shadcn/transition',
    manifestBound: false,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/transition.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/transition',
    manifestBound: true,
  },
] as const;

describe('Transition actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of TRANSITION_FAMILIES) {
    it(`${family} loads only real family transition atoms`, async () => {
      const recipeId = `demo-${family}-transition`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'transition',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families['transition'].recipePrototypeIds].sort()
        ).toEqual(ids);
      } else {
        expect(ids).toEqual(['shadcn-button', 'shadcn-style-scope', 'shadcn-transition']);
      }
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the transition demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-transition"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} transition in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
