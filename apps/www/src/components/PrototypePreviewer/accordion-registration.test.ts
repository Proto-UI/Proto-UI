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
describe('Accordion actual DemoSpec registration', () => {
  for (const family of [
    'base',
    'shadcn',
    'brutalist',
    'bootstrap-2-3-2',
    'liquid-glass',
  ] as const) {
    it(`${family} loads only real family atoms and its independent application action`, async () => {
      const recipeId = `demo-${family}-accordion`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(
        ['root', 'item', 'heading', 'trigger', 'content']
          .map((role) => `${family}-accordion-${role}`)
          .concat(`${family}-button`)
          .sort()
      );
      for (const id of ids) {
        await loadPrototype(id);
        expect(getPrototype(id)?.name).toBe(id);
      }
      if (family !== 'base') {
        expect(resolveProjectionRecipe(recipeId)).toEqual({
          projectionFamilyId: family,
          familyId: 'accordion',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.accordion.recipePrototypeIds].sort()
        ).toEqual(ids);
      }
    });
  }
});
