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

// Context Menu is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const CONTEXT_MENU_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'context-menu.mdx',
    slug: 'ui-libraries/base/context-menu',
  },
  {
    family: 'shadcn',
    mdxPath: 'context-menu.mdx',
    slug: 'ui-libraries/shadcn/context-menu',
  },
  {
    family: 'brutalist',
    mdxPath: 'components/context-menu.mdx',
    slug: 'ui-libraries/brutalist/components/context-menu',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'context-menu.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/context-menu',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'context-menu.mdx',
    slug: 'ui-libraries/liquid-glass/context-menu',
  },
] as const;

const CONTEXT_MENU_ROLES = [
  'context-menu-content',
  'context-menu-item',
  'context-menu-root',
  'context-menu-trigger',
] as const;

describe('Context Menu actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of CONTEXT_MENU_FAMILIES) {
    it(`${family} loads only real family context-menu atoms`, async () => {
      const recipeId = `demo-${family}-context-menu`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(CONTEXT_MENU_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the context-menu demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-context-menu"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} context-menu in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
