import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';

function prototypes(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(prototypes),
  ];
}

// Autocomplete is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const AUTOCOMPLETE_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'autocomplete.mdx',
    slug: 'ui-libraries/base/autocomplete',
  },
  {
    family: 'shadcn',
    mdxPath: 'autocomplete.mdx',
    slug: 'ui-libraries/shadcn/autocomplete',
  },
  {
    family: 'brutalist',
    mdxPath: 'components/autocomplete.mdx',
    slug: 'ui-libraries/brutalist/components/autocomplete',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'autocomplete.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/autocomplete',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'autocomplete.mdx',
    slug: 'ui-libraries/liquid-glass/autocomplete',
  },
] as const;

const AUTOCOMPLETE_ROLES = [
  'autocomplete-content',
  'autocomplete-empty',
  'autocomplete-input',
  'autocomplete-item',
  'autocomplete-root',
  'autocomplete-trigger',
] as const;

describe('Autocomplete actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of AUTOCOMPLETE_FAMILIES) {
    it(`${family} loads only real family autocomplete atoms`, async () => {
      const recipeId = `demo-${family}-autocomplete`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(AUTOCOMPLETE_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the autocomplete demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-autocomplete"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} autocomplete in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
