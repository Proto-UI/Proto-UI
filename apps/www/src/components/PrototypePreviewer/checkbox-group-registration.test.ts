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

// Checkbox Group is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const CHECKBOX_GROUP_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'checkbox-group.mdx',
    slug: 'ui-libraries/base/checkbox-group',
  },
  {
    family: 'shadcn',
    mdxPath: 'checkbox-group.mdx',
    slug: 'ui-libraries/shadcn/checkbox-group',
  },
  {
    family: 'brutalist',
    mdxPath: 'checkbox-group.mdx',
    slug: 'ui-libraries/brutalist/checkbox-group',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'checkbox-group.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/checkbox-group',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'checkbox-group.mdx',
    slug: 'ui-libraries/liquid-glass/checkbox-group',
  },
] as const;

const CHECKBOX_GROUP_ROLES = [
  'checkbox-group-all',
  'checkbox-group-item',
  'checkbox-group-root',
] as const;

describe('Checkbox Group actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of CHECKBOX_GROUP_FAMILIES) {
    it(`${family} loads only real family checkbox-group atoms`, async () => {
      const recipeId = `demo-${family}-checkbox-group`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(CHECKBOX_GROUP_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the checkbox-group demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-checkbox-group"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} checkbox-group in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
