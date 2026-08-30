import { describe, expect, it } from 'vitest';

import {
  PROJECTION_FAMILY_MANIFESTS,
  SHARED_BASE_FAMILY_IDS,
  resolveProjectionPart,
  resolveProjectionRecipe,
  tryResolveProjectionRecipe,
  validateProjectionFamilyManifest,
  type ProjectionFamilyManifest,
  type ProjectionFamilyManifestRegistry,
} from './projection-families';

const EXPECTED_SHARED_BASE_FAMILY_IDS = [
  'button',
  'toggle',
  'switch',
  'tabs',
  'hover-card',
  'dropdown-menu',
  'select',
  'dialog',
  'separator',
  'textarea',
] as const;

const EXPECTED_COMPONENT_IDS = {
  shadcn: [...EXPECTED_SHARED_BASE_FAMILY_IDS, 'checkbox'],
  brutalist: [...EXPECTED_SHARED_BASE_FAMILY_IDS, 'badge', 'card', 'skeleton', 'scroll-area'],
} as const;

const EXPECTED_REQUIRED_PART_IDS = {
  button: ['root'],
  toggle: ['root'],
  switch: ['root', 'thumb'],
  tabs: ['root', 'list', 'trigger', 'content'],
  'hover-card': ['root', 'trigger', 'content'],
  'dropdown-menu': ['root', 'trigger', 'content', 'item'],
  select: ['root', 'trigger', 'value', 'content', 'item'],
  dialog: [
    'root',
    'trigger',
    'mask',
    'content',
    'title',
    'description',
    'close',
    'closeIcon',
    'header',
    'footer',
  ],
  separator: ['root'],
  textarea: ['root'],
  checkbox: ['root', 'indicator'],
  badge: ['root'],
  card: ['root', 'header', 'content', 'footer'],
  skeleton: ['root'],
  'scroll-area': ['root', 'viewport', 'scrollbar', 'thumb'],
} as const;

const EXPECTED_THEME_REFERENCES = {
  shadcn: {
    themeArtifactId: 'website-shadcn-theme',
    themeInputId: 'website-root-computed-pui-theme',
  },
  brutalist: {
    themeArtifactId: 'prototype-brutalist-theme',
    themeInputId: 'website-brutalist-theme-mode',
  },
} as const;

const EXPECTED_LANE_ONLY_FAMILIES = {
  shadcn: {
    checkbox: {
      baseFamilyId: 'P-BASE-CHECKBOX',
      recipeId: 'demo-shadcn-checkbox',
      recipePrototypeIds: ['shadcn-checkbox-root', 'shadcn-checkbox-indicator'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-CHECKBOX',
          prototypeId: 'shadcn-checkbox-root',
        },
        indicator: {
          basePrototypeId: 'P-BASE-CHECKBOX-INDICATOR',
          prototypeId: 'shadcn-checkbox-indicator',
        },
      },
    },
  },
  brutalist: {
    badge: {
      baseFamilyId: null,
      recipeId: 'demo-brutalist-badge',
      recipePrototypeIds: ['brutalist-badge-root'],
      parts: {
        root: { basePrototypeId: null, prototypeId: 'brutalist-badge-root' },
      },
    },
    card: {
      baseFamilyId: null,
      recipeId: 'demo-brutalist-card',
      recipePrototypeIds: [
        'brutalist-card-root',
        'brutalist-card-header',
        'brutalist-card-content',
        'brutalist-card-footer',
        'brutalist-button',
      ],
      parts: {
        root: { basePrototypeId: null, prototypeId: 'brutalist-card-root' },
        header: { basePrototypeId: null, prototypeId: 'brutalist-card-header' },
        content: { basePrototypeId: null, prototypeId: 'brutalist-card-content' },
        footer: { basePrototypeId: null, prototypeId: 'brutalist-card-footer' },
      },
    },
    skeleton: {
      baseFamilyId: null,
      recipeId: 'demo-brutalist-skeleton',
      recipePrototypeIds: ['brutalist-skeleton-root'],
      parts: {
        root: { basePrototypeId: null, prototypeId: 'brutalist-skeleton-root' },
      },
    },
    'scroll-area': {
      baseFamilyId: 'P-BASE-SCROLL-AREA',
      recipeId: 'demo-brutalist-scroll-area',
      recipePrototypeIds: [
        'brutalist-scroll-area-root',
        'brutalist-scroll-area-viewport',
        'brutalist-scroll-area-scrollbar',
        'brutalist-scroll-area-thumb',
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-SCROLL-AREA',
          prototypeId: 'brutalist-scroll-area-root',
        },
        viewport: {
          basePrototypeId: 'P-BASE-SCROLL-AREA-VIEWPORT',
          prototypeId: 'brutalist-scroll-area-viewport',
        },
        scrollbar: {
          basePrototypeId: 'P-BASE-SCROLL-AREA-SCROLLBAR',
          prototypeId: 'brutalist-scroll-area-scrollbar',
        },
        thumb: {
          basePrototypeId: 'P-BASE-SCROLL-AREA-THUMB',
          prototypeId: 'brutalist-scroll-area-thumb',
        },
      },
    },
  },
} as const;

const EXPECTED_RECIPE_PROTOTYPE_IDS = {
  shadcn: {
    button: ['shadcn-button'],
    toggle: ['shadcn-toggle', 'lucide-icon'],
    switch: ['shadcn-switch-root', 'shadcn-switch-thumb'],
    tabs: ['shadcn-tabs-root', 'shadcn-tabs-list', 'shadcn-tabs-trigger', 'shadcn-tabs-content'],
    'hover-card': [
      'shadcn-hover-card-root',
      'shadcn-hover-card-trigger',
      'shadcn-hover-card-content',
    ],
    'dropdown-menu': [
      'shadcn-dropdown-root',
      'shadcn-dropdown-trigger',
      'shadcn-dropdown-content',
      'shadcn-dropdown-item',
    ],
    select: [
      'shadcn-select-root',
      'shadcn-select-trigger',
      'shadcn-select-value',
      'shadcn-select-content',
      'shadcn-select-item',
    ],
    dialog: [
      'shadcn-dialog-root',
      'shadcn-dialog-trigger',
      'shadcn-dialog-mask',
      'shadcn-dialog-content',
      'shadcn-dialog-title',
      'shadcn-dialog-description',
      'shadcn-dialog-close',
      'shadcn-dialog-close-icon',
      'shadcn-dialog-header',
      'shadcn-dialog-footer',
      'shadcn-button',
    ],
    separator: ['shadcn-separator-root'],
    textarea: ['shadcn-textarea-root'],
  },
  brutalist: {
    button: ['brutalist-button'],
    toggle: ['brutalist-toggle'],
    switch: ['brutalist-switch-root', 'brutalist-switch-thumb'],
    tabs: [
      'brutalist-tabs-root',
      'brutalist-tabs-list',
      'brutalist-tabs-trigger',
      'brutalist-tabs-content',
    ],
    'hover-card': [
      'brutalist-hover-card-root',
      'brutalist-hover-card-trigger',
      'brutalist-hover-card-content',
    ],
    'dropdown-menu': [
      'brutalist-dropdown-root',
      'brutalist-dropdown-trigger',
      'brutalist-dropdown-content',
      'brutalist-dropdown-item',
    ],
    select: [
      'brutalist-select-root',
      'brutalist-select-trigger',
      'brutalist-select-value',
      'brutalist-select-content',
      'brutalist-select-item',
    ],
    dialog: [
      'brutalist-dialog-root',
      'brutalist-dialog-trigger',
      'brutalist-dialog-mask',
      'brutalist-dialog-content',
      'brutalist-dialog-title',
      'brutalist-dialog-description',
      'brutalist-dialog-close',
      'brutalist-dialog-close-icon',
      'brutalist-dialog-header',
      'brutalist-dialog-footer',
      'brutalist-button',
    ],
    separator: ['brutalist-separator-root'],
    textarea: ['brutalist-textarea-root'],
  },
} as const;

const EXPECTED_FAMILIES = {
  shadcn: {
    button: {
      baseFamilyId: 'P-BASE-BUTTON',
      recipeId: 'demo-shadcn-button',
      root: { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'shadcn-button' },
    },
    toggle: {
      baseFamilyId: 'P-BASE-TOGGLE',
      recipeId: 'demo-shadcn-toggle',
      root: { basePrototypeId: 'P-BASE-TOGGLE', prototypeId: 'shadcn-toggle' },
    },
    switch: {
      baseFamilyId: 'P-BASE-SWITCH',
      recipeId: 'demo-shadcn-switch',
      root: { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'shadcn-switch-root' },
    },
    tabs: {
      baseFamilyId: 'P-BASE-TABS',
      recipeId: 'demo-shadcn-tabs',
      root: { basePrototypeId: 'P-BASE-TABS', prototypeId: 'shadcn-tabs-root' },
    },
    'hover-card': {
      baseFamilyId: 'P-BASE-HOVER-CARD',
      recipeId: 'demo-shadcn-hover-card',
      root: { basePrototypeId: 'P-BASE-HOVER-CARD', prototypeId: 'shadcn-hover-card-root' },
    },
    'dropdown-menu': {
      baseFamilyId: 'P-BASE-DROPDOWN-MENU',
      recipeId: 'demo-shadcn-dropdown-menu',
      root: {
        basePrototypeId: 'P-BASE-DROPDOWN-MENU',
        prototypeId: 'shadcn-dropdown-root',
      },
    },
    select: {
      baseFamilyId: 'P-BASE-SELECT',
      recipeId: 'demo-shadcn-select',
      root: { basePrototypeId: 'P-BASE-SELECT', prototypeId: 'shadcn-select-root' },
    },
    dialog: {
      baseFamilyId: 'P-BASE-DIALOG',
      recipeId: 'demo-shadcn-dialog',
      root: { basePrototypeId: 'P-BASE-DIALOG', prototypeId: 'shadcn-dialog-root' },
    },
    separator: {
      baseFamilyId: 'P-BASE-SEPARATOR',
      recipeId: 'demo-shadcn-separator',
      root: { basePrototypeId: 'P-BASE-SEPARATOR', prototypeId: 'shadcn-separator-root' },
    },
    textarea: {
      baseFamilyId: 'P-BASE-TEXTAREA',
      recipeId: 'demo-shadcn-textarea',
      root: { basePrototypeId: 'P-BASE-TEXTAREA', prototypeId: 'shadcn-textarea-root' },
    },
  },
  brutalist: {
    button: {
      baseFamilyId: 'P-BASE-BUTTON',
      recipeId: 'demo-brutalist-button',
      root: { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' },
    },
    toggle: {
      baseFamilyId: 'P-BASE-TOGGLE',
      recipeId: 'demo-brutalist-toggle',
      root: { basePrototypeId: 'P-BASE-TOGGLE', prototypeId: 'brutalist-toggle' },
    },
    switch: {
      baseFamilyId: 'P-BASE-SWITCH',
      recipeId: 'demo-brutalist-switch',
      root: { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'brutalist-switch-root' },
    },
    tabs: {
      baseFamilyId: 'P-BASE-TABS',
      recipeId: 'demo-brutalist-tabs',
      root: { basePrototypeId: 'P-BASE-TABS', prototypeId: 'brutalist-tabs-root' },
    },
    'hover-card': {
      baseFamilyId: 'P-BASE-HOVER-CARD',
      recipeId: 'demo-brutalist-hover-card',
      root: {
        basePrototypeId: 'P-BASE-HOVER-CARD',
        prototypeId: 'brutalist-hover-card-root',
      },
    },
    'dropdown-menu': {
      baseFamilyId: 'P-BASE-DROPDOWN-MENU',
      recipeId: 'demo-brutalist-dropdown-menu',
      root: {
        basePrototypeId: 'P-BASE-DROPDOWN-MENU',
        prototypeId: 'brutalist-dropdown-root',
      },
    },
    select: {
      baseFamilyId: 'P-BASE-SELECT',
      recipeId: 'demo-brutalist-select',
      root: { basePrototypeId: 'P-BASE-SELECT', prototypeId: 'brutalist-select-root' },
    },
    dialog: {
      baseFamilyId: 'P-BASE-DIALOG',
      recipeId: 'demo-brutalist-dialog',
      root: { basePrototypeId: 'P-BASE-DIALOG', prototypeId: 'brutalist-dialog-root' },
    },
    separator: {
      baseFamilyId: 'P-BASE-SEPARATOR',
      recipeId: 'demo-brutalist-separator',
      root: {
        basePrototypeId: 'P-BASE-SEPARATOR',
        prototypeId: 'brutalist-separator-root',
      },
    },
    textarea: {
      baseFamilyId: 'P-BASE-TEXTAREA',
      recipeId: 'demo-brutalist-textarea',
      root: { basePrototypeId: 'P-BASE-TEXTAREA', prototypeId: 'brutalist-textarea-root' },
    },
  },
} as const;

const EXPECTED_SELECT_PARTS = {
  shadcn: {
    root: { basePrototypeId: 'P-BASE-SELECT', prototypeId: 'shadcn-select-root' },
    trigger: {
      basePrototypeId: 'P-BASE-SELECT-TRIGGER',
      prototypeId: 'shadcn-select-trigger',
    },
    value: { basePrototypeId: 'P-BASE-SELECT-VALUE', prototypeId: 'shadcn-select-value' },
    content: {
      basePrototypeId: 'P-BASE-SELECT-CONTENT',
      prototypeId: 'shadcn-select-content',
    },
    item: { basePrototypeId: 'P-BASE-SELECT-ITEM', prototypeId: 'shadcn-select-item' },
  },
  brutalist: {
    root: { basePrototypeId: 'P-BASE-SELECT', prototypeId: 'brutalist-select-root' },
    trigger: {
      basePrototypeId: 'P-BASE-SELECT-TRIGGER',
      prototypeId: 'brutalist-select-trigger',
    },
    value: {
      basePrototypeId: 'P-BASE-SELECT-VALUE',
      prototypeId: 'brutalist-select-value',
    },
    content: {
      basePrototypeId: 'P-BASE-SELECT-CONTENT',
      prototypeId: 'brutalist-select-content',
    },
    item: { basePrototypeId: 'P-BASE-SELECT-ITEM', prototypeId: 'brutalist-select-item' },
  },
} as const;

type ProjectionFamilyId = keyof typeof EXPECTED_FAMILIES;

function withoutFamily(
  manifest: ProjectionFamilyManifest,
  familyId: string
): ProjectionFamilyManifest {
  const families = { ...manifest.families } as Record<string, unknown>;
  delete families[familyId];
  return { ...manifest, families } as ProjectionFamilyManifest;
}

function withoutPart(
  manifest: ProjectionFamilyManifest,
  familyId: string,
  partId: string
): ProjectionFamilyManifest {
  const family = manifest.families[familyId];
  if (!family) throw new Error(`Test fixture requires ${familyId}.`);
  const parts = { ...family.parts } as Record<string, unknown>;
  delete parts[partId];
  return {
    ...manifest,
    families: {
      ...manifest.families,
      [familyId]: { ...family, parts },
    },
  } as ProjectionFamilyManifest;
}

describe('Website projection-family manifests', () => {
  it('explicitly catalogs the same ten Base families in the Shadcn and Brutalist lanes', () => {
    expect(SHARED_BASE_FAMILY_IDS).toEqual(EXPECTED_SHARED_BASE_FAMILY_IDS);
    expect(Object.keys(PROJECTION_FAMILY_MANIFESTS).sort()).toEqual(['brutalist', 'shadcn']);

    for (const projectionFamilyId of ['shadcn', 'brutalist'] as const) {
      const manifest = PROJECTION_FAMILY_MANIFESTS[projectionFamilyId];
      expect(manifest.projectionFamilyId).toBe(projectionFamilyId);
      expect({
        themeArtifactId: manifest.themeArtifactId,
        themeInputId: manifest.themeInputId,
      }).toEqual(EXPECTED_THEME_REFERENCES[projectionFamilyId]);
      expect(Object.keys(manifest.families).sort()).toEqual(
        [...EXPECTED_COMPONENT_IDS[projectionFamilyId]].sort()
      );

      for (const familyId of EXPECTED_SHARED_BASE_FAMILY_IDS) {
        const expected = EXPECTED_FAMILIES[projectionFamilyId][familyId];
        const actual = manifest.families[familyId];
        expect(actual.baseFamilyId, `${projectionFamilyId}/${familyId}/Base lineage`).toBe(
          expected.baseFamilyId
        );
        expect(actual.recipeId, `${projectionFamilyId}/${familyId}/recipe`).toBe(expected.recipeId);
        expect(
          actual.recipePrototypeIds,
          `${projectionFamilyId}/${familyId}/recipe Prototypes`
        ).toEqual(EXPECTED_RECIPE_PROTOTYPE_IDS[projectionFamilyId][familyId]);
        expect(actual.parts.root, `${projectionFamilyId}/${familyId}/root`).toEqual(expected.root);
        expect(
          Object.keys(actual.parts).sort(),
          `${projectionFamilyId}/${familyId}/required parts`
        ).toEqual([...EXPECTED_REQUIRED_PART_IDS[familyId]].sort());
      }

      expect(JSON.stringify(manifest.families)).not.toContain('--pui-');
      expect(() => validateProjectionFamilyManifest(manifest)).not.toThrow();
    }
  });

  it('catalogs exact lane-only recipes without inventing a cross-lane counterpart', () => {
    for (const projectionFamilyId of ['shadcn', 'brutalist'] as const) {
      const expectedFamilies = EXPECTED_LANE_ONLY_FAMILIES[projectionFamilyId];
      for (const [componentId, expected] of Object.entries(expectedFamilies)) {
        const manifest = PROJECTION_FAMILY_MANIFESTS[
          projectionFamilyId
        ] as ProjectionFamilyManifest;
        const actual = manifest.families[componentId];
        expect(actual, `${projectionFamilyId}/${componentId}`).toEqual(expected);
        expect(resolveProjectionRecipe(expected.recipeId)).toEqual({
          projectionFamilyId,
          familyId: componentId,
        });
      }
    }

    expect(tryResolveProjectionRecipe('demo-brutalist-checkbox')).toBeNull();
    expect(tryResolveProjectionRecipe('demo-shadcn-card')).toBeNull();
  });

  it('declares every required Base Select part with a concrete same-lane Prototype identity', () => {
    for (const projectionFamilyId of ['shadcn', 'brutalist'] as const) {
      const select = PROJECTION_FAMILY_MANIFESTS[projectionFamilyId].families.select;
      expect(Object.keys(select.parts).sort()).toEqual([
        'content',
        'item',
        'root',
        'trigger',
        'value',
      ]);
      expect(select.parts).toEqual(EXPECTED_SELECT_PARTS[projectionFamilyId]);

      for (const partId of Object.keys(EXPECTED_SELECT_PARTS[projectionFamilyId])) {
        expect(resolveProjectionPart(projectionFamilyId, 'select', partId)).toEqual(
          EXPECTED_SELECT_PARTS[projectionFamilyId][
            partId as keyof (typeof EXPECTED_SELECT_PARTS)[typeof projectionFamilyId]
          ]
        );
      }
    }
  });

  it('uses exact manifest keys instead of inferring a lane or family from Prototype names', () => {
    expect(() => resolveProjectionPart('shadcn-button', 'button', 'root')).toThrow(
      /projection family.*shadcn-button/i
    );
    expect(() => resolveProjectionPart('shadcn', 'shadcn-select', 'root')).toThrow(
      /family.*shadcn-select/i
    );
    expect(() => resolveProjectionPart('brutalist', 'brutalist-select', 'trigger')).toThrow(
      /family.*brutalist-select/i
    );
    expect(tryResolveProjectionRecipe('demo-shadcn-select')).toEqual({
      projectionFamilyId: 'shadcn',
      familyId: 'select',
    });
    expect(tryResolveProjectionRecipe('demo-custom-select')).toBeNull();
    expect(() => resolveProjectionRecipe('demo-custom-select')).toThrow(
      /unknown projection recipe/i
    );
  });

  it('fails closed when a lane is missing a shared family instead of borrowing another lane', () => {
    const incompleteShadcn = withoutFamily(PROJECTION_FAMILY_MANIFESTS.shadcn, 'select');
    const registry: ProjectionFamilyManifestRegistry = {
      ...PROJECTION_FAMILY_MANIFESTS,
      shadcn: incompleteShadcn,
    };

    expect(() => validateProjectionFamilyManifest(incompleteShadcn)).toThrow(
      /shadcn.*select|select.*shadcn/i
    );
    expect(() => resolveProjectionPart('shadcn', 'select', 'root', registry)).toThrow(
      /shadcn.*select|select.*shadcn/i
    );
    expect(resolveProjectionPart('brutalist', 'select', 'root', registry)).toEqual(
      EXPECTED_SELECT_PARTS.brutalist.root
    );
  });

  it('fails closed on a missing required part even when the other lane has that part', () => {
    for (const projectionFamilyId of ['shadcn', 'brutalist'] as const) {
      const otherFamilyId: ProjectionFamilyId =
        projectionFamilyId === 'shadcn' ? 'brutalist' : 'shadcn';
      const incomplete = withoutPart(
        PROJECTION_FAMILY_MANIFESTS[projectionFamilyId],
        'select',
        'trigger'
      );
      const registry: ProjectionFamilyManifestRegistry = {
        ...PROJECTION_FAMILY_MANIFESTS,
        [projectionFamilyId]: incomplete,
      };

      expect(() => validateProjectionFamilyManifest(incomplete)).toThrow(
        new RegExp(
          `${projectionFamilyId}.*select.*trigger|trigger.*select.*${projectionFamilyId}`,
          'i'
        )
      );
      expect(() =>
        resolveProjectionPart(projectionFamilyId, 'select', 'trigger', registry)
      ).toThrow(/select.*trigger|trigger.*select/i);
      expect(resolveProjectionPart(otherFamilyId, 'select', 'trigger', registry)).toEqual(
        EXPECTED_SELECT_PARTS[otherFamilyId].trigger
      );
    }
  });

  it('fails closed when a recipe Prototype dependency is missing, foreign, or duplicated', () => {
    const button = PROJECTION_FAMILY_MANIFESTS.shadcn.families.button;
    for (const recipePrototypeIds of [
      [],
      ['brutalist-button'],
      ['shadcn-button', 'shadcn-button'],
    ]) {
      const invalid = {
        ...PROJECTION_FAMILY_MANIFESTS.shadcn,
        families: {
          ...PROJECTION_FAMILY_MANIFESTS.shadcn.families,
          button: { ...button, recipePrototypeIds },
        },
      } as ProjectionFamilyManifest;

      expect(() => validateProjectionFamilyManifest(invalid)).toThrow(/recipe Prototype set/i);
    }
  });
});
