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

// Toggle Group is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const TOGGLE_GROUP_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'toggle-group.mdx',
    slug: 'ui-libraries/base/toggle-group',
  },
  {
    family: 'shadcn',
    mdxPath: 'toggle-group.mdx',
    slug: 'ui-libraries/shadcn/toggle-group',
  },
  {
    family: 'brutalist',
    mdxPath: 'components/toggle-group.mdx',
    slug: 'ui-libraries/brutalist/components/toggle-group',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'toggle-group.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/toggle-group',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'toggle-group.mdx',
    slug: 'ui-libraries/liquid-glass/toggle-group',
  },
] as const;

const TOGGLE_GROUP_ROLES = ['toggle-group-item', 'toggle-group-root'] as const;

describe('Toggle Group actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of TOGGLE_GROUP_FAMILIES) {
    it(`${family} loads only real family toggle-group atoms`, async () => {
      const recipeId = `demo-${family}-toggle-group`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(TOGGLE_GROUP_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the toggle-group demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-toggle-group"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} toggle-group in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
