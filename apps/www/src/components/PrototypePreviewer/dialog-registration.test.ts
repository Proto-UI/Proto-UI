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

// Dialog is published (recipe + MDX page + sidebar) for base and shadcn. The
// runtimes differ per family: base dialog omits vue2, shadcn dialog includes it.
const DIALOG_FAMILIES = [
  { family: 'base', runtimes: "['wc', 'react', 'vue']" },
  { family: 'shadcn', runtimes: "['wc', 'react', 'vue', 'vue2']" },
] as const;

describe('Dialog actual DemoSpec registration', () => {
  for (const { family, runtimes } of DIALOG_FAMILIES) {
    it(`${family} loads only real family dialog atoms`, async () => {
      const demo = await loadDemo(`demo-${family}-dialog`);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the dialog demo with its declared runtimes`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/dialog.mdx`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-dialog"`);
        expect(source).toContain(`runtimes={${runtimes}}`);
      });
    }

    it(`lists ${family} dialog in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: 'ui-libraries/${family}/dialog'`);
    });
  }
});
