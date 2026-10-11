import { describe, expect, it } from 'vitest';
import { loadDemo } from './demo-modules';
import { loadPrototype } from './prototype-modules';
import { getPrototype } from './registry';
import { assertDemoSpec, type DemoChild } from './demo-types';
import { PROJECTION_FAMILY_MANIFESTS, resolveProjectionRecipe, validateProjectionFamilyManifest } from './projection-families';
function prototypes(node: DemoChild): string[] {
  if (typeof node === 'string' || node.kind === 'text') return [];
  return [
    ...(node.kind === 'proto' ? [node.prototypeId] : []),
    ...(node.children ?? []).flatMap(prototypes),
  ];
}
describe('Field actual DemoSpec registration', () => {
  for (const family of [
    'base',
    'shadcn',
    'brutalist',
    'bootstrap-2-3-2',
    'liquid-glass',
  ] as const) {
    it(`${family} loads only real family atoms and its independent application action`, async () => {
      const recipeId = `demo-${family}-field`;
      const demo = await loadDemo(recipeId);
      expect(() => assertDemoSpec(demo)).not.toThrow();
      const ids = [...new Set(prototypes(demo.root))].sort();
      expect(ids).toEqual(
        ['root', 'label', 'control', 'description', 'error', 'validity']
          .map((role) => `${family}-field-${role}`)
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
          familyId: 'field',
        });
        expect(
          [...PROJECTION_FAMILY_MANIFESTS[family].families.field.recipePrototypeIds].sort()
        ).toEqual(ids);
      }
    });
  }
});

describe('Field projection negative controls', () => {
  for (const family of ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'] as const) {
    it(`${family} rejects omission of an atomic Error instead of falling back`, () => {
      const manifest = structuredClone(PROJECTION_FAMILY_MANIFESTS[family]);
      delete (manifest.families.field.parts as Record<string, unknown>).error;
      expect(() => validateProjectionFamilyManifest(manifest)).toThrow(/field.*error|error.*field/);
    });
  }
});
