import { describe, expect, it } from 'vitest';
import {
  PROJECTION_FAMILY_MANIFESTS,
  resolveProjectionPart,
  resolveProjectionRecipe,
  tryResolveProjectionRecipe,
  validateProjectionFamilyManifest,
  type ProjectionFamilyManifest,
  type ProjectionFamilyManifestRegistry,
} from './projection-families';

type FamilyId = keyof typeof PROJECTION_FAMILY_MANIFESTS;
const familyIds: FamilyId[] = ['shadcn', 'brutalist', 'bootstrap-2-3-2', 'liquid-glass'];

function withoutFamily(manifest: ProjectionFamilyManifest, familyId: string): ProjectionFamilyManifest {
  const families = { ...manifest.families };
  delete families[familyId];
  return { ...manifest, families };
}

function withoutPart(manifest: ProjectionFamilyManifest, familyId: string, partId: string): ProjectionFamilyManifest {
  const family = manifest.families[familyId];
  if (!family) throw new Error(`Test fixture requires ${familyId}.`);
  const parts = { ...family.parts };
  delete parts[partId];
  return { ...manifest, families: { ...manifest.families, [familyId]: { ...family, parts } } };
}

function withManifest(id: FamilyId, manifest: ProjectionFamilyManifest): ProjectionFamilyManifestRegistry {
  return { ...PROJECTION_FAMILY_MANIFESTS, [id]: manifest };
}

describe('Website projection-family admission boundaries', () => {
  it('uses explicit family and recipe keys rather than inferring identities from names', () => {
    expect(() => resolveProjectionPart('shadcn-button', 'button', 'root')).toThrow(/projection family.*shadcn-button/i);
    expect(() => resolveProjectionPart('shadcn', 'shadcn-select', 'root')).toThrow(/family.*shadcn-select/i);
    expect(() => resolveProjectionPart('brutalist', 'brutalist-select', 'trigger')).toThrow(/family.*brutalist-select/i);
    expect(tryResolveProjectionRecipe('demo-custom-select')).toBeNull();
    expect(() => resolveProjectionRecipe('demo-custom-select')).toThrow(/unknown projection recipe/i);
    expect(() => resolveProjectionPart('brutalist', 'checkbox', 'label')).toThrow(/checkbox.*no part label/i);
  });

  for (const id of familyIds) {
    it(`${id} rejects a missing Select family without borrowing another family`, () => {
      const invalid = withoutFamily(PROJECTION_FAMILY_MANIFESTS[id], 'select');
      const registry = withManifest(id, invalid);
      expect(() => validateProjectionFamilyManifest(invalid)).toThrow(/select/i);
      expect(() => resolveProjectionPart(id, 'select', 'root', registry)).toThrow(/select/i);
      const unaffected = id === 'shadcn' ? 'brutalist' : 'shadcn';
      expect(resolveProjectionPart(unaffected, 'select', 'root', registry).prototypeId)
        .toBe(`${unaffected}-select-root`);
    });

    const requiredSelectParts = id === 'brutalist'
      ? ['trigger']
      : ['trigger', 'surface', 'viewport', 'itemText', 'group', 'label', 'separator'];
    for (const part of requiredSelectParts) {
      it(`${id} rejects a missing Select ${part} instead of substituting another owner`, () => {
        const invalid = withoutPart(PROJECTION_FAMILY_MANIFESTS[id], 'select', part);
        const registry = withManifest(id, invalid);
        expect(() => validateProjectionFamilyManifest(invalid)).toThrow(new RegExp(part, 'i'));
        expect(() => resolveProjectionPart(id, 'select', part, registry)).toThrow(new RegExp(part, 'i'));
      });
    }

    if (id !== 'brutalist') {
      for (const part of ['textarea', 'selectTrigger', 'switch']) {
        it(`${id} rejects an omitted Field ${part} variant from its complete recipe`, () => {
          const invalid = withoutPart(PROJECTION_FAMILY_MANIFESTS[id], 'field', part);
          expect(() => resolveProjectionRecipe(`demo-${id}-field`, withManifest(id, invalid)))
            .toThrow(new RegExp(part, 'i'));
        });
      }
      it(`${id} rejects missing Tabs Indicator ownership`, () => {
        const invalid = withoutPart(PROJECTION_FAMILY_MANIFESTS[id], 'tabs', 'indicator');
        expect(() => validateProjectionFamilyManifest(invalid)).toThrow(/indicator/i);
      });
    }
  }

  it('rejects an incomplete Checkbox while the other family remains usable', () => {
    const invalid = withoutPart(PROJECTION_FAMILY_MANIFESTS.brutalist, 'checkbox', 'indicator');
    const registry = withManifest('brutalist', invalid);
    expect(() => tryResolveProjectionRecipe('demo-brutalist-checkbox', registry)).toThrow(/checkbox.*indicator/i);
    expect(() => resolveProjectionPart('brutalist', 'checkbox', 'indicator', registry)).toThrow(/checkbox.*indicator/i);
    expect(resolveProjectionPart('shadcn', 'checkbox', 'indicator', registry).prototypeId).toBe('shadcn-checkbox-indicator');
  });

  for (const id of ['shadcn', 'brutalist', 'liquid-glass'] as const) {
    for (const part of ['group', 'label', 'separator', 'shortcut']) {
      it(`${id} rejects removal of the Dropdown ${part} from its declared recipe`, () => {
        const invalid = withoutPart(PROJECTION_FAMILY_MANIFESTS[id], 'dropdown-menu', part);
        expect(() => validateProjectionFamilyManifest(invalid)).toThrow(new RegExp(part, 'i'));
      });
    }
  }

  it('rejects a recipe auxiliary with false Base lineage', () => {
    const manifest = PROJECTION_FAMILY_MANIFESTS.shadcn;
    const invalid: ProjectionFamilyManifest = {
      ...manifest,
      families: {
        ...manifest.families,
        toggle: {
          ...manifest.families.toggle,
          auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-TOGGLE', prototypeId: 'lucide-icon' }],
        },
      },
    };
    expect(() => validateProjectionFamilyManifest(invalid)).toThrow(/toggle.*auxiliary Prototype lineage/i);
  });

  it('rejects missing, foreign and duplicate recipe dependencies', () => {
    const manifest = PROJECTION_FAMILY_MANIFESTS.shadcn;
    for (const recipePrototypeIds of [[], ['brutalist-button'], ['shadcn-button', 'shadcn-button']]) {
      const invalid: ProjectionFamilyManifest = {
        ...manifest,
        families: { ...manifest.families, button: { ...manifest.families.button, recipePrototypeIds } },
      };
      expect(() => validateProjectionFamilyManifest(invalid)).toThrow(/recipe Prototype set/i);
    }
  });
});
