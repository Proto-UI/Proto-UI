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

// Navigation Menu is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const NAVIGATION_MENU_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'navigation-menu.mdx',
    slug: 'ui-libraries/base/navigation-menu',
  },
  {
    family: 'shadcn',
    mdxPath: 'navigation-menu.mdx',
    slug: 'ui-libraries/shadcn/navigation-menu',
  },
  {
    family: 'brutalist',
    mdxPath: 'components/navigation-menu.mdx',
    slug: 'ui-libraries/brutalist/components/navigation-menu',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'navigation-menu.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/navigation-menu',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'navigation-menu.mdx',
    slug: 'ui-libraries/liquid-glass/navigation-menu',
  },
] as const;

const NAVIGATION_MENU_ROLES = [
  'navigation-menu-content',
  'navigation-menu-item',
  'navigation-menu-link',
  'navigation-menu-root',
  'navigation-menu-trigger',
] as const;

describe('Navigation Menu actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of NAVIGATION_MENU_FAMILIES) {
    it(`${family} loads only real family navigation-menu atoms`, async () => {
      const recipeId = `demo-${family}-navigation-menu`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(NAVIGATION_MENU_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the navigation-menu demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-navigation-menu"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} navigation-menu in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
