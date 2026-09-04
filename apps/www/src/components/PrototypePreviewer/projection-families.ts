export const SHARED_BASE_FAMILY_IDS = [
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

export type SharedBaseFamilyId = (typeof SHARED_BASE_FAMILY_IDS)[number];
export type ProjectionComponentId =
  | SharedBaseFamilyId
  | 'checkbox'
  | 'badge'
  | 'card'
  | 'skeleton'
  | 'scroll-area'
  | 'tooltip';
export type ProjectionFamilyId = 'shadcn' | 'brutalist';

export type ProjectionPartManifest = Readonly<{
  /**
   * The cataloged Base identity represented by this part. Layout-only
   * anatomy helpers that have no Base Prototype declare `null` explicitly.
   */
  basePrototypeId: string | null;
  prototypeId: string;
}>;

export type ProjectionComponentFamilyManifest = Readonly<{
  baseFamilyId: string | null;
  recipeId: string;
  recipePrototypeIds: readonly string[];
  parts: Readonly<Record<string, ProjectionPartManifest>>;
}>;

export type ProjectionFamilyManifest = Readonly<{
  projectionFamilyId: string;
  themeArtifactId: string;
  themeInputId: string;
  families: Readonly<Record<string, ProjectionComponentFamilyManifest>>;
}>;

export type ProjectionFamilyManifestRegistry = Readonly<Record<string, ProjectionFamilyManifest>>;

const REQUIRED_PART_IDS: Readonly<Record<ProjectionComponentId, readonly string[]>> = {
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
  tooltip: ['group', 'root', 'trigger', 'content'],
};

const SHADCN_MANIFEST = {
  projectionFamilyId: 'shadcn',
  themeArtifactId: 'website-shadcn-theme',
  themeInputId: 'website-root-computed-pui-theme',
  families: {
    button: {
      baseFamilyId: 'P-BASE-BUTTON',
      recipeId: 'demo-shadcn-button',
      recipePrototypeIds: ['shadcn-button'],
      parts: {
        root: { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'shadcn-button' },
      },
    },
    toggle: {
      baseFamilyId: 'P-BASE-TOGGLE',
      recipeId: 'demo-shadcn-toggle',
      recipePrototypeIds: ['shadcn-toggle', 'lucide-icon'],
      parts: {
        root: { basePrototypeId: 'P-BASE-TOGGLE', prototypeId: 'shadcn-toggle' },
      },
    },
    switch: {
      baseFamilyId: 'P-BASE-SWITCH',
      recipeId: 'demo-shadcn-switch',
      recipePrototypeIds: ['shadcn-switch-root', 'shadcn-switch-thumb'],
      parts: {
        root: { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'shadcn-switch-root' },
        thumb: {
          basePrototypeId: 'P-BASE-SWITCH-THUMB',
          prototypeId: 'shadcn-switch-thumb',
        },
      },
    },
    tabs: {
      baseFamilyId: 'P-BASE-TABS',
      recipeId: 'demo-shadcn-tabs',
      recipePrototypeIds: [
        'shadcn-tabs-root',
        'shadcn-tabs-list',
        'shadcn-tabs-trigger',
        'shadcn-tabs-content',
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-TABS', prototypeId: 'shadcn-tabs-root' },
        list: { basePrototypeId: 'P-BASE-TABS-LIST', prototypeId: 'shadcn-tabs-list' },
        trigger: {
          basePrototypeId: 'P-BASE-TABS-TRIGGER',
          prototypeId: 'shadcn-tabs-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-TABS-CONTENT',
          prototypeId: 'shadcn-tabs-content',
        },
      },
    },
    'hover-card': {
      baseFamilyId: 'P-BASE-HOVER-CARD',
      recipeId: 'demo-shadcn-hover-card',
      recipePrototypeIds: [
        'shadcn-hover-card-root',
        'shadcn-hover-card-trigger',
        'shadcn-hover-card-content',
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-HOVER-CARD',
          prototypeId: 'shadcn-hover-card-root',
        },
        trigger: {
          basePrototypeId: 'P-BASE-HOVER-CARD-TRIGGER',
          prototypeId: 'shadcn-hover-card-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-HOVER-CARD-CONTENT',
          prototypeId: 'shadcn-hover-card-content',
        },
      },
    },
    'dropdown-menu': {
      baseFamilyId: 'P-BASE-DROPDOWN-MENU',
      recipeId: 'demo-shadcn-dropdown-menu',
      recipePrototypeIds: [
        'shadcn-dropdown-root',
        'shadcn-dropdown-trigger',
        'shadcn-dropdown-content',
        'shadcn-dropdown-item',
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU',
          prototypeId: 'shadcn-dropdown-root',
        },
        trigger: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU-TRIGGER',
          prototypeId: 'shadcn-dropdown-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU-CONTENT',
          prototypeId: 'shadcn-dropdown-content',
        },
        item: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU-ITEM',
          prototypeId: 'shadcn-dropdown-item',
        },
      },
    },
    select: {
      baseFamilyId: 'P-BASE-SELECT',
      recipeId: 'demo-shadcn-select',
      recipePrototypeIds: [
        'shadcn-select-root',
        'shadcn-select-trigger',
        'shadcn-select-value',
        'shadcn-select-content',
        'shadcn-select-item',
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-SELECT', prototypeId: 'shadcn-select-root' },
        trigger: {
          basePrototypeId: 'P-BASE-SELECT-TRIGGER',
          prototypeId: 'shadcn-select-trigger',
        },
        value: {
          basePrototypeId: 'P-BASE-SELECT-VALUE',
          prototypeId: 'shadcn-select-value',
        },
        content: {
          basePrototypeId: 'P-BASE-SELECT-CONTENT',
          prototypeId: 'shadcn-select-content',
        },
        item: {
          basePrototypeId: 'P-BASE-SELECT-ITEM',
          prototypeId: 'shadcn-select-item',
        },
      },
    },
    dialog: {
      baseFamilyId: 'P-BASE-DIALOG',
      recipeId: 'demo-shadcn-dialog',
      recipePrototypeIds: [
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
      parts: {
        root: { basePrototypeId: 'P-BASE-DIALOG', prototypeId: 'shadcn-dialog-root' },
        trigger: {
          basePrototypeId: 'P-BASE-DIALOG-TRIGGER',
          prototypeId: 'shadcn-dialog-trigger',
        },
        mask: {
          basePrototypeId: 'P-BASE-DIALOG-MASK',
          prototypeId: 'shadcn-dialog-mask',
        },
        content: {
          basePrototypeId: 'P-BASE-DIALOG-CONTENT',
          prototypeId: 'shadcn-dialog-content',
        },
        title: {
          basePrototypeId: 'P-BASE-DIALOG-TITLE',
          prototypeId: 'shadcn-dialog-title',
        },
        description: {
          basePrototypeId: 'P-BASE-DIALOG-DESCRIPTION',
          prototypeId: 'shadcn-dialog-description',
        },
        close: {
          basePrototypeId: 'P-BASE-DIALOG-CLOSE',
          prototypeId: 'shadcn-dialog-close',
        },
        closeIcon: {
          basePrototypeId: 'P-BASE-DIALOG-CLOSE',
          prototypeId: 'shadcn-dialog-close-icon',
        },
        header: { basePrototypeId: null, prototypeId: 'shadcn-dialog-header' },
        footer: { basePrototypeId: null, prototypeId: 'shadcn-dialog-footer' },
      },
    },
    separator: {
      baseFamilyId: 'P-BASE-SEPARATOR',
      recipeId: 'demo-shadcn-separator',
      recipePrototypeIds: ['shadcn-separator-root'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-SEPARATOR',
          prototypeId: 'shadcn-separator-root',
        },
      },
    },
    textarea: {
      baseFamilyId: 'P-BASE-TEXTAREA',
      recipeId: 'demo-shadcn-textarea',
      recipePrototypeIds: ['shadcn-textarea-root'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-TEXTAREA',
          prototypeId: 'shadcn-textarea-root',
        },
      },
    },
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
} as const satisfies ProjectionFamilyManifest;

const BRUTALIST_MANIFEST = {
  projectionFamilyId: 'brutalist',
  themeArtifactId: 'prototype-brutalist-theme',
  themeInputId: 'website-brutalist-theme-mode',
  families: {
    button: {
      baseFamilyId: 'P-BASE-BUTTON',
      recipeId: 'demo-brutalist-button',
      recipePrototypeIds: ['brutalist-button'],
      parts: {
        root: { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' },
      },
    },
    toggle: {
      baseFamilyId: 'P-BASE-TOGGLE',
      recipeId: 'demo-brutalist-toggle',
      recipePrototypeIds: ['brutalist-toggle'],
      parts: {
        root: { basePrototypeId: 'P-BASE-TOGGLE', prototypeId: 'brutalist-toggle' },
      },
    },
    switch: {
      baseFamilyId: 'P-BASE-SWITCH',
      recipeId: 'demo-brutalist-switch',
      recipePrototypeIds: ['brutalist-switch-root', 'brutalist-switch-thumb'],
      parts: {
        root: { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'brutalist-switch-root' },
        thumb: {
          basePrototypeId: 'P-BASE-SWITCH-THUMB',
          prototypeId: 'brutalist-switch-thumb',
        },
      },
    },
    tabs: {
      baseFamilyId: 'P-BASE-TABS',
      recipeId: 'demo-brutalist-tabs',
      recipePrototypeIds: [
        'brutalist-tabs-root',
        'brutalist-tabs-list',
        'brutalist-tabs-trigger',
        'brutalist-tabs-content',
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-TABS', prototypeId: 'brutalist-tabs-root' },
        list: { basePrototypeId: 'P-BASE-TABS-LIST', prototypeId: 'brutalist-tabs-list' },
        trigger: {
          basePrototypeId: 'P-BASE-TABS-TRIGGER',
          prototypeId: 'brutalist-tabs-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-TABS-CONTENT',
          prototypeId: 'brutalist-tabs-content',
        },
      },
    },
    'hover-card': {
      baseFamilyId: 'P-BASE-HOVER-CARD',
      recipeId: 'demo-brutalist-hover-card',
      recipePrototypeIds: [
        'brutalist-hover-card-root',
        'brutalist-hover-card-trigger',
        'brutalist-hover-card-content',
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-HOVER-CARD',
          prototypeId: 'brutalist-hover-card-root',
        },
        trigger: {
          basePrototypeId: 'P-BASE-HOVER-CARD-TRIGGER',
          prototypeId: 'brutalist-hover-card-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-HOVER-CARD-CONTENT',
          prototypeId: 'brutalist-hover-card-content',
        },
      },
    },
    'dropdown-menu': {
      baseFamilyId: 'P-BASE-DROPDOWN-MENU',
      recipeId: 'demo-brutalist-dropdown-menu',
      recipePrototypeIds: [
        'brutalist-dropdown-root',
        'brutalist-dropdown-trigger',
        'brutalist-dropdown-content',
        'brutalist-dropdown-item',
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU',
          prototypeId: 'brutalist-dropdown-root',
        },
        trigger: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU-TRIGGER',
          prototypeId: 'brutalist-dropdown-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU-CONTENT',
          prototypeId: 'brutalist-dropdown-content',
        },
        item: {
          basePrototypeId: 'P-BASE-DROPDOWN-MENU-ITEM',
          prototypeId: 'brutalist-dropdown-item',
        },
      },
    },
    select: {
      baseFamilyId: 'P-BASE-SELECT',
      recipeId: 'demo-brutalist-select',
      recipePrototypeIds: [
        'brutalist-select-root',
        'brutalist-select-trigger',
        'brutalist-select-value',
        'brutalist-select-content',
        'brutalist-select-item',
      ],
      parts: {
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
        item: {
          basePrototypeId: 'P-BASE-SELECT-ITEM',
          prototypeId: 'brutalist-select-item',
        },
      },
    },
    dialog: {
      baseFamilyId: 'P-BASE-DIALOG',
      recipeId: 'demo-brutalist-dialog',
      recipePrototypeIds: [
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
      parts: {
        root: { basePrototypeId: 'P-BASE-DIALOG', prototypeId: 'brutalist-dialog-root' },
        trigger: {
          basePrototypeId: 'P-BASE-DIALOG-TRIGGER',
          prototypeId: 'brutalist-dialog-trigger',
        },
        mask: {
          basePrototypeId: 'P-BASE-DIALOG-MASK',
          prototypeId: 'brutalist-dialog-mask',
        },
        content: {
          basePrototypeId: 'P-BASE-DIALOG-CONTENT',
          prototypeId: 'brutalist-dialog-content',
        },
        title: {
          basePrototypeId: 'P-BASE-DIALOG-TITLE',
          prototypeId: 'brutalist-dialog-title',
        },
        description: {
          basePrototypeId: 'P-BASE-DIALOG-DESCRIPTION',
          prototypeId: 'brutalist-dialog-description',
        },
        close: {
          basePrototypeId: 'P-BASE-DIALOG-CLOSE',
          prototypeId: 'brutalist-dialog-close',
        },
        closeIcon: {
          basePrototypeId: 'P-BASE-DIALOG-CLOSE',
          prototypeId: 'brutalist-dialog-close-icon',
        },
        header: { basePrototypeId: null, prototypeId: 'brutalist-dialog-header' },
        footer: { basePrototypeId: null, prototypeId: 'brutalist-dialog-footer' },
      },
    },
    separator: {
      baseFamilyId: 'P-BASE-SEPARATOR',
      recipeId: 'demo-brutalist-separator',
      recipePrototypeIds: ['brutalist-separator-root'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-SEPARATOR',
          prototypeId: 'brutalist-separator-root',
        },
      },
    },
    textarea: {
      baseFamilyId: 'P-BASE-TEXTAREA',
      recipeId: 'demo-brutalist-textarea',
      recipePrototypeIds: ['brutalist-textarea-root'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-TEXTAREA',
          prototypeId: 'brutalist-textarea-root',
        },
      },
    },
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
    tooltip: {
      baseFamilyId: 'P-BASE-TOOLTIP',
      recipeId: 'demo-brutalist-tooltip',
      recipePrototypeIds: [
        'brutalist-tooltip-group',
        'brutalist-tooltip-root',
        'brutalist-tooltip-trigger',
        'brutalist-tooltip-content',
      ],
      parts: {
        group: {
          basePrototypeId: 'P-BASE-TOOLTIP-GROUP',
          prototypeId: 'brutalist-tooltip-group',
        },
        root: {
          basePrototypeId: 'P-BASE-TOOLTIP',
          prototypeId: 'brutalist-tooltip-root',
        },
        trigger: {
          basePrototypeId: 'P-BASE-TOOLTIP-TRIGGER',
          prototypeId: 'brutalist-tooltip-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-TOOLTIP-CONTENT',
          prototypeId: 'brutalist-tooltip-content',
        },
      },
    },
  },
} as const satisfies ProjectionFamilyManifest;

export const PROJECTION_FAMILY_MANIFESTS = Object.freeze({
  shadcn: SHADCN_MANIFEST,
  brutalist: BRUTALIST_MANIFEST,
}) satisfies ProjectionFamilyManifestRegistry;

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

function assertExactKeys(
  actual: Readonly<Record<string, unknown>>,
  expected: readonly string[],
  context: string
): void {
  for (const key of expected) {
    if (!hasOwn(actual, key)) {
      throw new Error(`[PrototypePreviewer] ${context} is missing required ${key}.`);
    }
  }

  for (const key of Object.keys(actual)) {
    if (!expected.includes(key)) {
      throw new Error(`[PrototypePreviewer] ${context} declares unsupported ${key}.`);
    }
  }
}

function canonicalManifest(projectionFamilyId: string): ProjectionFamilyManifest {
  const manifest = (PROJECTION_FAMILY_MANIFESTS as ProjectionFamilyManifestRegistry)[
    projectionFamilyId
  ];
  if (!manifest) {
    throw new Error(
      `[PrototypePreviewer] unknown projection family "${projectionFamilyId}"; no name inference or cross-family fallback is allowed.`
    );
  }
  return manifest;
}

export function validateProjectionFamilyManifest(manifest: ProjectionFamilyManifest): void {
  const projectionFamilyId = manifest?.projectionFamilyId;
  const canonical = canonicalManifest(projectionFamilyId);

  if (manifest.themeArtifactId !== canonical.themeArtifactId) {
    throw new Error(
      `[PrototypePreviewer] projection family ${projectionFamilyId} has an invalid or missing theme artifact.`
    );
  }
  if (manifest.themeInputId !== canonical.themeInputId) {
    throw new Error(
      `[PrototypePreviewer] projection family ${projectionFamilyId} has an invalid or missing theme input.`
    );
  }

  const canonicalFamilies = canonical.families as Readonly<
    Record<string, ProjectionComponentFamilyManifest>
  >;
  assertExactKeys(
    manifest.families,
    Object.keys(canonicalFamilies),
    `projection family ${projectionFamilyId}`
  );

  for (const familyId of Object.keys(canonicalFamilies)) {
    const family = manifest.families[familyId];
    const expectedFamily = canonicalFamilies[familyId];
    if (!family || !expectedFamily) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} is missing family ${familyId}.`
      );
    }
    if (family.baseFamilyId !== expectedFamily.baseFamilyId) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has an invalid Base lineage.`
      );
    }
    if (family.recipeId !== expectedFamily.recipeId) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has an invalid recipe.`
      );
    }
    if (!Array.isArray(family.recipePrototypeIds)) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has an invalid recipe Prototype set.`
      );
    }
    const actualRecipePrototypeIds = [...family.recipePrototypeIds];
    const expectedRecipePrototypeIds = [...expectedFamily.recipePrototypeIds];
    if (
      new Set(actualRecipePrototypeIds).size !== actualRecipePrototypeIds.length ||
      actualRecipePrototypeIds.length !== expectedRecipePrototypeIds.length ||
      expectedRecipePrototypeIds.some(
        (prototypeId) => !actualRecipePrototypeIds.includes(prototypeId)
      )
    ) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has an invalid recipe Prototype set.`
      );
    }

    const requiredPartIds = REQUIRED_PART_IDS[familyId as ProjectionComponentId];
    if (!requiredPartIds) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has no declared part contract.`
      );
    }
    assertExactKeys(
      family.parts,
      requiredPartIds,
      `projection family ${projectionFamilyId} family ${familyId}`
    );

    for (const partId of requiredPartIds) {
      const part = family.parts[partId];
      const expectedPart = expectedFamily.parts[partId];
      if (!part || !expectedPart) {
        throw new Error(
          `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} is missing part ${partId}.`
        );
      }
      if (
        part.basePrototypeId !== expectedPart.basePrototypeId ||
        part.prototypeId !== expectedPart.prototypeId
      ) {
        throw new Error(
          `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} part ${partId} does not match its explicit Prototype identity.`
        );
      }
    }
  }
}

export function resolveProjectionPart(
  projectionFamilyId: string,
  familyId: string,
  partId: string,
  registry: ProjectionFamilyManifestRegistry = PROJECTION_FAMILY_MANIFESTS
): ProjectionPartManifest {
  const manifest = registry[projectionFamilyId];
  if (!manifest) {
    throw new Error(
      `[PrototypePreviewer] unknown projection family "${projectionFamilyId}"; no name inference or cross-family fallback is allowed.`
    );
  }
  validateProjectionFamilyManifest(manifest);

  const family = manifest.families[familyId];
  if (!family) {
    throw new Error(
      `[PrototypePreviewer] projection family ${projectionFamilyId} has no family ${familyId}; cross-family fallback is forbidden.`
    );
  }
  const part = family.parts[partId];
  if (!part) {
    throw new Error(
      `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has no part ${partId}; cross-family fallback is forbidden.`
    );
  }
  return part;
}

export type ProjectionRecipeResolution = Readonly<{
  projectionFamilyId: string;
  familyId: ProjectionComponentId;
}>;

/** Try only exact manifest recipe IDs; names and prefixes carry no meaning. */
export function tryResolveProjectionRecipe(
  recipeId: string,
  registry: ProjectionFamilyManifestRegistry = PROJECTION_FAMILY_MANIFESTS
): ProjectionRecipeResolution | null {
  let match: ProjectionRecipeResolution | undefined;

  for (const [projectionFamilyId, manifest] of Object.entries(registry)) {
    validateProjectionFamilyManifest(manifest);
    for (const [familyId, family] of Object.entries(manifest.families)) {
      if (family.recipeId !== recipeId) continue;
      if (match) {
        throw new Error(`[PrototypePreviewer] projection recipe "${recipeId}" is ambiguous.`);
      }
      match = { projectionFamilyId, familyId: familyId as ProjectionComponentId };
    }
  }

  return match ?? null;
}

/** Resolve only exact manifest recipe IDs; names and prefixes carry no meaning. */
export function resolveProjectionRecipe(
  recipeId: string,
  registry: ProjectionFamilyManifestRegistry = PROJECTION_FAMILY_MANIFESTS
): ProjectionRecipeResolution {
  const match = tryResolveProjectionRecipe(recipeId, registry);

  if (!match) {
    throw new Error(
      `[PrototypePreviewer] unknown projection recipe "${recipeId}"; name inference is forbidden.`
    );
  }
  return match;
}
