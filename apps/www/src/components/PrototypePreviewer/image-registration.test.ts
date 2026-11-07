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

// Shadcn has no projection-manifest entry for image, so its demo only needs
// real, loadable prototypes under the non-manifest guard. Brutalist is
// manifest-bound: its recipe must resolve and list exactly the demoed parts.
// Both pages live under different docs roots — shadcn keeps the flat
// `ui-libraries/shadcn/image` slug while brutalist drafts sit under
// `ui-libraries/brutalist/components/`.
const IMAGE_FAMILIES = [
  {
    family: 'shadcn',
    mdxPath: 'image.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/shadcn/image',
    manifestBound: false,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/image.mdx',
    runtimes: null,
    slug: 'ui-libraries/brutalist/components/image',
    manifestBound: true,
  },
] as const;

describe('Image actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtimes, slug, manifestBound } of IMAGE_FAMILIES) {
    it(`${family} loads only real family image atoms`, async () => {
      const recipeId = `demo-${family}-image`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'image',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families['image'].recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the image demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-image"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} image in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
