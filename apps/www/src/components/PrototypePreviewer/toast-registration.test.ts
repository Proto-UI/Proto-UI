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

// Toast is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const TOAST_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/base/toast',
  },
  {
    family: 'shadcn',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/shadcn/toast',
  },
  {
    family: 'brutalist',
    mdxPath: 'components/toast.mdx',
    slug: 'ui-libraries/brutalist/components/toast',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/toast',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'toast.mdx',
    slug: 'ui-libraries/liquid-glass/toast',
  },
] as const;

const TOAST_ROLES = [
  'button',
  'toast-action',
  'toast-close',
  'toast-description',
  'toast-root',
  'toast-title',
  'toast-viewport',
] as const;

describe('Toast actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of TOAST_FAMILIES) {
    it(`${family} loads only real family toast atoms`, async () => {
      const recipeId = `demo-${family}-toast`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(TOAST_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the toast demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-toast"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} toast in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
