import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';
import { PROJECTION_FAMILY_MANIFESTS, resolveProjectionRecipe } from './projection-families';

function prototypes(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(prototypes),
  ];
}

// Radio group is published for base and shadcn only. Both declare the demo with
// initialRuntime="wc"; base additionally exposes a three-runtime selector (no
// vue2), shadcn declares only initialRuntime. Both use a plain `radio-group.mdx`.
// base has no projection-manifest entry, so its id list is not manifest-bound.
const RADIO_GROUP_FAMILIES = [
  {
    family: 'base',
    mdxPath: 'radio-group.mdx',
    runtimes: "runtimes={['wc', 'react', 'vue']}",
    slug: 'ui-libraries/base/radio-group',
    manifestBound: false,
  },
  {
    family: 'shadcn',
    mdxPath: 'radio-group.mdx',
    runtimes: null,
    slug: 'ui-libraries/shadcn/radio-group',
    manifestBound: true,
  },
] as const;

describe('Radio group actual DemoSpec registration', () => {
  it('pairs every Shadcn visible option label without a duplicate hidden name', async () => {
    const demo = await loadDemo('demo-shadcn-radio-group');
    const nodes: Exclude<DemoChild, string>[] = [];
    const visit = (node: DemoChild): void => {
      if (typeof node === 'string') return;
      nodes.push(node);
      if (node.kind !== 'text') node.children?.forEach(visit);
    };
    visit(demo.root);
    const items = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-radio-group-item'
    );
    const labels = nodes.filter(
      (node) => node.kind === 'proto' && node.prototypeId === 'shadcn-label-root'
    );
    expect(items).toHaveLength(9);
    expect(labels).toHaveLength(9);
    const keys = new Set<string>();
    for (const item of items) {
      if (item.kind !== 'proto') throw new Error('Expected Radio Item');
      const key = item.associations?.controlLabel;
      expect(key).toBeTruthy();
      keys.add(key!);
      const paired = labels.filter(
        (label) => label.kind === 'proto' && label.associations?.controlLabel === key
      );
      expect(paired).toHaveLength(1);
      const label = paired[0];
      if (label?.kind !== 'proto') throw new Error('Expected paired Label');
      // Omission exercises the actual Base default rather than a demo override.
      expect(label.props?.activation).toBeUndefined();
      expect(item.children).toEqual([
        { kind: 'proto', prototypeId: 'shadcn-radio-group-indicator' },
      ]);
    }
    expect(keys.size).toBe(9);
  });

  for (const { family, mdxPath, runtimes, slug, manifestBound } of RADIO_GROUP_FAMILIES) {
    it(`${family} loads only real family radio group atoms`, async () => {
      const recipeId = `demo-${family}-radio-group`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      if (manifestBound) {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'radio-group',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families['radio-group'].recipePrototypeIds].sort()
        ).toEqual(ids);
      } else {
        expect(ids.length).toBeGreaterThan(0);
      }
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
    }, 30000);

    for (const locale of ['en', 'zh-cn'] as const) {
      it(`${locale}/${family} exposes the radio group demo with its declared runtime`, () => {
        const source = readFileSync(
          `apps/www/src/content/docs/${locale}/ui-libraries/${family}/${mdxPath}`,
          'utf8'
        );
        expect(source).toContain(`demoId="demo-${family}-radio-group"`);
        expect(source).toContain('initialRuntime="wc"');
        if (runtimes) {
          expect(source).toContain(runtimes);
        }
      });
    }

    it(`lists ${family} radio group in the sidebar`, () => {
      const config = readFileSync('apps/www/astro.config.mjs', 'utf8');
      expect(config).toContain(`slug: '${slug}'`);
    });
  }
});
