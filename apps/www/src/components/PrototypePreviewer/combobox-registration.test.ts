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

// Combobox is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const COMBOBOX_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'combobox.mdx',
    slug: 'ui-libraries/base/combobox',
  },
  {
    family: 'shadcn',
    mdxPath: 'combobox.mdx',
    slug: 'ui-libraries/shadcn/combobox',
  },
  {
    family: 'brutalist',
    mdxPath: 'components/combobox.mdx',
    slug: 'ui-libraries/brutalist/components/combobox',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'combobox.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/combobox',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'combobox.mdx',
    slug: 'ui-libraries/liquid-glass/combobox',
  },
] as const;

const COMBOBOX_ROLES = [
  'combobox-content',
  'combobox-empty',
  'combobox-input',
  'combobox-item',
  'combobox-root',
  'combobox-trigger',
] as const;

describe('Combobox actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of COMBOBOX_FAMILIES) {
    it(`${family} loads only real family combobox atoms`, async () => {
      const recipeId = `demo-${family}-combobox`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(COMBOBOX_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the combobox demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-combobox"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} combobox in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
