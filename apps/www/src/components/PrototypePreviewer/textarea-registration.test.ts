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

// Textarea is published for base, shadcn, brutalist, and bootstrap-2-3-2 (there
// is no liquid-glass textarea page). All declare initialRuntime="wc". base
// exposes a three-runtime selector (no vue2); bootstrap exposes a four-runtime
// selector (including vue2); shadcn and brutalist declare only initialRuntime.
// base/shadcn/bootstrap use `textarea.mdx`; brutalist publishes at
// `components/textarea.mdx`. base has no manifest entry, so its id set is
// asserted exactly against the published atom role; the other three are
// manifest-bound.
const TEXTAREA_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'textarea.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue']}"],
    sidebarSlug: 'ui-libraries/base/textarea',
    manifestBound: false,
    expectedIds: ['base-textarea-root'],
  },
  {
    family: 'shadcn',
    mdxPath: 'textarea.mdx',
    runtimes: [],
    sidebarSlug: 'ui-libraries/shadcn/textarea',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'brutalist',
    mdxPath: 'components/textarea.mdx',
    runtimes: [],
    sidebarSlug: 'ui-libraries/brutalist/components/textarea',
    manifestBound: true,
    expectedIds: null,
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'textarea.mdx',
    runtimes: ["runtimes={['wc', 'react', 'vue', 'vue2']}"],
    sidebarSlug: 'ui-libraries/bootstrap-2-3-2/textarea',
    manifestBound: true,
    expectedIds: null,
  },
] as const;

describe('Textarea actual DemoSpec registration', () => {
  for (const {
    family,
    mdxPath,
    runtimes,
    sidebarSlug,
    manifestBound,
    expectedIds,
  } of TEXTAREA_FAMILIES) {
    it(`${family} loads only real family textarea atoms`, async () => {
      const recipeId = `demo-${family}-textarea`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'textarea',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.textarea.recipePrototypeIds].sort()
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
      it(`${locale}/${family} exposes the textarea demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-textarea"`);
        expect(source).toContain('initialRuntime="wc"');
        for (const runtime of runtimes) {
          expect(source).toContain(runtime);
        }
      });
    }

    if (sidebarSlug) {
      it(`lists ${family} textarea in the sidebar`, () => {
        const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
        expect(config).toContain(`slug: '${sidebarSlug}'`);
      });
    }
  }
});
