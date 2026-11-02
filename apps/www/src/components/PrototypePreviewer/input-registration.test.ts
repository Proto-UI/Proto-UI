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

// Input is published for base, shadcn, and brutalist. All three declare the demo
// with `initialRuntime="wc"` (a plain root atom, no runtimes array). base/shadcn
// use a plain `input.mdx`; brutalist publishes at `components/input.mdx`. base
// has no projection-manifest entry, so its id list is not manifest-bound.
const INPUT_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'input.mdx',
    runtime: 'initialRuntime="wc"',
    slug: 'ui-libraries/base/input',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'input.mdx',
    runtime: 'initialRuntime="wc"',
    slug: 'ui-libraries/shadcn/input',
    manifestBound: true,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/input.mdx',
    runtime: 'initialRuntime="wc"',
    slug: 'ui-libraries/brutalist/components/input',
    manifestBound: true,
  },
] as const;

describe('Input actual DemoSpec registration', () => {
  for (const { family, mdxPath, runtime, slug, manifestBound } of INPUT_FAMILIES) {
    it(`${family} loads only real family input atoms`, async () => {
      const recipeId = `demo-${family}-input`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'input',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.input.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the input demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-input"`);
        expect(source).toContain(runtime);
      });
    }

    it(`lists ${family} input in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
