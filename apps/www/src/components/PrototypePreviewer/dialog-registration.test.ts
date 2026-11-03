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

// Dialog is published for base, shadcn, and brutalist. base/shadcn use a plain
// `dialog.mdx` with a `runtimes` array; brutalist publishes at
// `components/dialog.mdx` with an `initialRuntime` instead. base has no
// projection-manifest entry, so its exact id list is not manifest-bound (the
// accordion test makes the same base/non-base distinction).
const DIALOG_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'dialog.mdx',
    runtime: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/dialog',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'dialog.mdx',
    runtime: "runtimes={['wc', 'react', 'vue', 'vue2']}",
    slug: 'ui-libraries/shadcn/dialog',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/dialog.mdx',
    runtime: 'initialRuntime="wc"',
    slug: 'ui-libraries/brutalist/components/dialog',
    manifestBound: true,
  },
] as const;

describe('Dialog actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtime, slug, manifestBound } of DIALOG_FAMILIES) {
    it(`${family} loads only real family dialog atoms`, async () => {
      const recipeId = `demo-${family}-dialog`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'dialog',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.dialog.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the dialog demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-dialog"`);
        expect(source).toContain(runtime);
      });
    }

    it(`lists ${family} dialog in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
