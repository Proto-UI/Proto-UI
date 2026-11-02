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

// Meter is published for base, shadcn, brutalist, bootstrap-2-3-2, and
// liquid-glass. Every family declares initialRuntime="wc" and a four-runtime
// selector (including vue2). None of the families has a projection manifest
// entry, so each demo's atom id set is asserted exactly against the published
// roles instead of being bound to a manifest.
const METER_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'meter.mdx',
    slug: 'ui-libraries/base/meter',
  },
  {
    family: 'shadcn',
    mdxPath: 'meter.mdx',
    slug: 'ui-libraries/shadcn/meter',
  },
  {
    family: 'brutalist',
    mdxPath: 'meter.mdx',
    slug: 'ui-libraries/brutalist/meter',
  },
  {
    family: 'bootstrap-2-3-2',
    mdxPath: 'meter.mdx',
    slug: 'ui-libraries/bootstrap-2-3-2/meter',
  },
  {
    family: 'liquid-glass',
    mdxPath: 'meter.mdx',
    slug: 'ui-libraries/liquid-glass/meter',
  },
] as const;

const METER_ROLES = [
  'button',
  'meter-indicator',
  'meter-label',
  'meter-root',
  'meter-track',
  'meter-value',
] as const;

describe('Meter actual DemoSpec registration', () => {
  for (const { family, mdxPath, slug } of METER_FAMILIES) {
    it(`${family} loads only real family meter atoms`, async () => {
      const recipeId = `demo-${family}-meter`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(METER_ROLES.map((role) => `${family}-${role}`).sort());
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the meter demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-meter"`);
        expect(source).toContain('initialRuntime="wc"');
        expect(source).toContain("runtimes={['wc', 'react', 'vue', 'vue2']}");
      });
    }

    it(`lists ${family} meter in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
