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

// Number Field is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const NUMBER_FIELD_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'number-field.mdx',
    slug: 'ui-libraries/base/number-field',
  },
  {
    family: 'shadcn',
    mdxPath: 'number-field.mdx',
    slug: 'ui-libraries/shadcn/number-field',
  },
  {
    family: 'brutalist',
    mdxPath: 'number-field.mdx',
    slug: 'ui-libraries/brutalist/number-field',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'number-field.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/number-field',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'number-field.mdx',
    slug: 'ui-libraries/liquid-glass/number-field',
  },
] as const;

const NUMBER_FIELD_ROLES = [
  'number-field-decrement',
  'number-field-increment',
  'number-field-input',
  'number-field-label',
  'number-field-root',
] as const;

describe('Number Field actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of NUMBER_FIELD_FAMILIES) {
    it(`${family} loads only real family number-field atoms`, async () => {
      const recipeId = `demo-${family}-number-field`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(NUMBER_FIELD_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the number-field demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-number-field"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} number-field in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
