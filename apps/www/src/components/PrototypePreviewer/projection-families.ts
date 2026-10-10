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
  | 'collapsible'
  | 'accordion'
  | 'field'
  | 'label'
  | 'text'
  | 'checkbox'
  | 'input'
  | 'radio-group'
  | 'badge'
  | 'card'
  | 'skeleton'
  | 'spinner'
  | 'scroll-area'
  | 'tooltip';
export type ProjectionFamilyId = 'shadcn' | 'brutalist' | 'bootstrap-2-3-2' | 'liquid-glass';

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
  auxiliaryPrototypes?: readonly ProjectionPartManifest[];
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
  collapsible: ['root', 'trigger', 'content'],
  accordion: ['root', 'item', 'heading', 'trigger', 'content'],
  field: ['root', 'label', 'control', 'description', 'error', 'validity'],
  label: ['root'],
  text: ['root'],
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
  input: ['root'],
  checkbox: ['root', 'indicator'],
  'radio-group': ['root', 'item', 'indicator'],
  badge: ['root'],
  card: ['root', 'header', 'content', 'footer'],
  skeleton: ['root'],
  spinner: ['root'],
  'scroll-area': ['root', 'viewport', 'scrollbar', 'thumb'],
  tooltip: ['group', 'root', 'trigger', 'content'],
};

const SHADCN_MANIFEST = {
  projectionFamilyId: 'shadcn',
  themeArtifactId: 'website-shadcn-theme',
  themeInputId: 'website-root-computed-pui-theme',
  families: {
    card: {
      baseFamilyId: null,
      recipeId: 'demo-shadcn-card',
      recipePrototypeIds: [
        'shadcn-card-root',
        'shadcn-card-header',
        'shadcn-card-content',
        'shadcn-card-footer',
        'shadcn-text-root',
      ],
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-TEXT', prototypeId: 'shadcn-text-root' }],
      parts: {
        root: { basePrototypeId: null, prototypeId: 'shadcn-card-root' },
        header: { basePrototypeId: null, prototypeId: 'shadcn-card-header' },
        content: { basePrototypeId: null, prototypeId: 'shadcn-card-content' },
        footer: { basePrototypeId: null, prototypeId: 'shadcn-card-footer' },
      },
    },
    field: {
      baseFamilyId: 'P-BASE-FIELD',
      recipeId: 'demo-shadcn-field',
      recipePrototypeIds: [
        'shadcn-field-root',
        'shadcn-field-label',
        'shadcn-field-control',
        'shadcn-field-description',
        'shadcn-field-error',
        'shadcn-field-validity',
        'shadcn-button',
      ],
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'shadcn-button' }],
      parts: {
        root: { basePrototypeId: 'P-BASE-FIELD', prototypeId: 'shadcn-field-root' },
        label: { basePrototypeId: 'P-BASE-FIELD-LABEL', prototypeId: 'shadcn-field-label' },
        control: { basePrototypeId: 'P-BASE-FIELD-CONTROL', prototypeId: 'shadcn-field-control' },
        description: {
          basePrototypeId: 'P-BASE-FIELD-DESCRIPTION',
          prototypeId: 'shadcn-field-description',
        },
        error: { basePrototypeId: 'P-BASE-FIELD-ERROR', prototypeId: 'shadcn-field-error' },
        validity: {
          basePrototypeId: 'P-BASE-FIELD-VALIDITY',
          prototypeId: 'shadcn-field-validity',
        },
      },
    },
    accordion: {
      baseFamilyId: 'P-BASE-ACCORDION',
      recipeId: 'demo-shadcn-accordion',
      recipePrototypeIds: [
        'shadcn-accordion-root',
        'shadcn-accordion-item',
        'shadcn-accordion-heading',
        'shadcn-accordion-trigger',
        'shadcn-accordion-content',
        'shadcn-button',
      ],
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'shadcn-button' }],
      parts: {
        root: { basePrototypeId: 'P-BASE-ACCORDION', prototypeId: 'shadcn-accordion-root' },
        item: { basePrototypeId: 'P-BASE-ACCORDION-ITEM', prototypeId: 'shadcn-accordion-item' },
        heading: {
          basePrototypeId: 'P-BASE-ACCORDION-HEADING',
          prototypeId: 'shadcn-accordion-heading',
        },
        trigger: {
          basePrototypeId: 'P-BASE-ACCORDION-TRIGGER',
          prototypeId: 'shadcn-accordion-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-ACCORDION-CONTENT',
          prototypeId: 'shadcn-accordion-content',
        },
      },
    },
    collapsible: {
      baseFamilyId: 'P-BASE-COLLAPSIBLE',
      recipeId: 'demo-shadcn-collapsible',
      recipePrototypeIds: [
        'shadcn-collapsible-root',
        'shadcn-collapsible-trigger',
        'shadcn-collapsible-content',
        'shadcn-button',
      ],
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'shadcn-button' }],
      parts: {
        root: { basePrototypeId: 'P-BASE-COLLAPSIBLE', prototypeId: 'shadcn-collapsible-root' },
        trigger: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-TRIGGER',
          prototypeId: 'shadcn-collapsible-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-CONTENT',
          prototypeId: 'shadcn-collapsible-content',
        },
      },
    },
    label: {
      baseFamilyId: 'P-BASE-LABEL',
      recipeId: 'demo-shadcn-label',
      recipePrototypeIds: [
        'shadcn-label-root',
        'base-checkbox-root',
        'base-switch-root',
        'base-radio-group-root',
        'base-radio-group-item',
        'base-input-root',
        'base-textarea-root',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-CHECKBOX', prototypeId: 'base-checkbox-root' },
        { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'base-switch-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP', prototypeId: 'base-radio-group-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP-ITEM', prototypeId: 'base-radio-group-item' },
        { basePrototypeId: 'P-BASE-INPUT', prototypeId: 'base-input-root' },
        { basePrototypeId: 'P-BASE-TEXTAREA', prototypeId: 'base-textarea-root' },
      ],
      parts: { root: { basePrototypeId: 'P-BASE-LABEL', prototypeId: 'shadcn-label-root' } },
    },
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
      auxiliaryPrototypes: [{ basePrototypeId: null, prototypeId: 'lucide-icon' }],
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
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'shadcn-button' }],
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
    input: {
      baseFamilyId: 'P-BASE-INPUT',
      recipeId: 'demo-shadcn-input',
      recipePrototypeIds: ['shadcn-input-root'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-INPUT',
          prototypeId: 'shadcn-input-root',
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
    'radio-group': {
      baseFamilyId: 'P-BASE-RADIO-GROUP',
      recipeId: 'demo-shadcn-radio-group',
      recipePrototypeIds: [
        'shadcn-radio-group-root',
        'shadcn-radio-group-item',
        'shadcn-radio-group-indicator',
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-RADIO-GROUP',
          prototypeId: 'shadcn-radio-group-root',
        },
        item: {
          basePrototypeId: 'P-BASE-RADIO-GROUP-ITEM',
          prototypeId: 'shadcn-radio-group-item',
        },
        indicator: {
          basePrototypeId: 'P-BASE-RADIO-GROUP-INDICATOR',
          prototypeId: 'shadcn-radio-group-indicator',
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
    field: {
      baseFamilyId: 'P-BASE-FIELD',
      recipeId: 'demo-brutalist-field',
      recipePrototypeIds: [
        'brutalist-field-root',
        'brutalist-field-label',
        'brutalist-field-control',
        'brutalist-field-description',
        'brutalist-field-error',
        'brutalist-field-validity',
        'brutalist-button',
      ],
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' }],
      parts: {
        root: { basePrototypeId: 'P-BASE-FIELD', prototypeId: 'brutalist-field-root' },
        label: { basePrototypeId: 'P-BASE-FIELD-LABEL', prototypeId: 'brutalist-field-label' },
        control: {
          basePrototypeId: 'P-BASE-FIELD-CONTROL',
          prototypeId: 'brutalist-field-control',
        },
        description: {
          basePrototypeId: 'P-BASE-FIELD-DESCRIPTION',
          prototypeId: 'brutalist-field-description',
        },
        error: { basePrototypeId: 'P-BASE-FIELD-ERROR', prototypeId: 'brutalist-field-error' },
        validity: {
          basePrototypeId: 'P-BASE-FIELD-VALIDITY',
          prototypeId: 'brutalist-field-validity',
        },
      },
    },
    accordion: {
      baseFamilyId: 'P-BASE-ACCORDION',
      recipeId: 'demo-brutalist-accordion',
      recipePrototypeIds: [
        'brutalist-accordion-root',
        'brutalist-accordion-item',
        'brutalist-accordion-heading',
        'brutalist-accordion-trigger',
        'brutalist-accordion-content',
        'brutalist-button',
      ],
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' }],
      parts: {
        root: { basePrototypeId: 'P-BASE-ACCORDION', prototypeId: 'brutalist-accordion-root' },
        item: { basePrototypeId: 'P-BASE-ACCORDION-ITEM', prototypeId: 'brutalist-accordion-item' },
        heading: {
          basePrototypeId: 'P-BASE-ACCORDION-HEADING',
          prototypeId: 'brutalist-accordion-heading',
        },
        trigger: {
          basePrototypeId: 'P-BASE-ACCORDION-TRIGGER',
          prototypeId: 'brutalist-accordion-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-ACCORDION-CONTENT',
          prototypeId: 'brutalist-accordion-content',
        },
      },
    },
    collapsible: {
      baseFamilyId: 'P-BASE-COLLAPSIBLE',
      recipeId: 'demo-brutalist-collapsible',
      recipePrototypeIds: [
        'brutalist-collapsible-root',
        'brutalist-collapsible-trigger',
        'brutalist-collapsible-content',
        'brutalist-button',
      ],
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' }],
      parts: {
        root: { basePrototypeId: 'P-BASE-COLLAPSIBLE', prototypeId: 'brutalist-collapsible-root' },
        trigger: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-TRIGGER',
          prototypeId: 'brutalist-collapsible-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-CONTENT',
          prototypeId: 'brutalist-collapsible-content',
        },
      },
    },
    label: {
      baseFamilyId: 'P-BASE-LABEL',
      recipeId: 'demo-brutalist-label',
      recipePrototypeIds: [
        'brutalist-label-root',
        'base-checkbox-root',
        'base-switch-root',
        'base-radio-group-root',
        'base-radio-group-item',
        'base-input-root',
        'base-textarea-root',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-CHECKBOX', prototypeId: 'base-checkbox-root' },
        { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'base-switch-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP', prototypeId: 'base-radio-group-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP-ITEM', prototypeId: 'base-radio-group-item' },
        { basePrototypeId: 'P-BASE-INPUT', prototypeId: 'base-input-root' },
        { basePrototypeId: 'P-BASE-TEXTAREA', prototypeId: 'base-textarea-root' },
      ],
      parts: { root: { basePrototypeId: 'P-BASE-LABEL', prototypeId: 'brutalist-label-root' } },
    },
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
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' }],
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
    checkbox: {
      baseFamilyId: 'P-BASE-CHECKBOX',
      recipeId: 'demo-brutalist-checkbox',
      recipePrototypeIds: ['brutalist-checkbox-root', 'brutalist-checkbox-indicator'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-CHECKBOX',
          prototypeId: 'brutalist-checkbox-root',
        },
        indicator: {
          basePrototypeId: 'P-BASE-CHECKBOX-INDICATOR',
          prototypeId: 'brutalist-checkbox-indicator',
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
      auxiliaryPrototypes: [{ basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' }],
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
    spinner: {
      baseFamilyId: null,
      recipeId: 'demo-brutalist-spinner',
      recipePrototypeIds: ['brutalist-spinner-root', 'brutalist-button', 'base-async-region-root'],
      parts: {
        root: { basePrototypeId: null, prototypeId: 'brutalist-spinner-root' },
      },
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'brutalist-button' },
        { basePrototypeId: 'P-BASE-ASYNC-REGION', prototypeId: 'base-async-region-root' },
      ],
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

const BOOTSTRAP_232_MANIFEST = {
  projectionFamilyId: 'bootstrap-2-3-2',
  themeArtifactId: 'prototype-bootstrap-2-3-2-theme',
  themeInputId: 'website-bootstrap-2-3-2-theme-mode',
  // Partial by design: no missing kind may borrow an implementation.
  families: {
    text: {
      baseFamilyId: 'P-BASE-TEXT',
      recipeId: 'demo-bootstrap-2-3-2-text',
      recipePrototypeIds: ['bootstrap-2-3-2-text-root'],
      parts: { root: { basePrototypeId: 'P-BASE-TEXT', prototypeId: 'bootstrap-2-3-2-text-root' } },
    },
    tabs: {
      baseFamilyId: 'P-BASE-TABS',
      recipeId: 'demo-bootstrap-2-3-2-tabs',
      recipePrototypeIds: [
        'bootstrap-2-3-2-tabs-root',
        'bootstrap-2-3-2-tabs-list',
        'bootstrap-2-3-2-tabs-trigger',
        'bootstrap-2-3-2-tabs-content',
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-TABS', prototypeId: 'bootstrap-2-3-2-tabs-root' },
        list: { basePrototypeId: 'P-BASE-TABS-LIST', prototypeId: 'bootstrap-2-3-2-tabs-list' },
        trigger: {
          basePrototypeId: 'P-BASE-TABS-TRIGGER',
          prototypeId: 'bootstrap-2-3-2-tabs-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-TABS-CONTENT',
          prototypeId: 'bootstrap-2-3-2-tabs-content',
        },
      },
    },
    select: {
      baseFamilyId: 'P-BASE-SELECT',
      recipeId: 'demo-bootstrap-2-3-2-select',
      recipePrototypeIds: [
        'bootstrap-2-3-2-select-root',
        'bootstrap-2-3-2-select-trigger',
        'bootstrap-2-3-2-select-value',
        'bootstrap-2-3-2-select-content',
        'bootstrap-2-3-2-select-item',
        'bootstrap-2-3-2-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'bootstrap-2-3-2-button' },
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-SELECT', prototypeId: 'bootstrap-2-3-2-select-root' },
        trigger: {
          basePrototypeId: 'P-BASE-SELECT-TRIGGER',
          prototypeId: 'bootstrap-2-3-2-select-trigger',
        },
        value: {
          basePrototypeId: 'P-BASE-SELECT-VALUE',
          prototypeId: 'bootstrap-2-3-2-select-value',
        },
        content: {
          basePrototypeId: 'P-BASE-SELECT-CONTENT',
          prototypeId: 'bootstrap-2-3-2-select-content',
        },
        item: { basePrototypeId: 'P-BASE-SELECT-ITEM', prototypeId: 'bootstrap-2-3-2-select-item' },
      },
    },
    field: {
      baseFamilyId: 'P-BASE-FIELD',
      recipeId: 'demo-bootstrap-2-3-2-field',
      recipePrototypeIds: [
        'bootstrap-2-3-2-field-root',
        'bootstrap-2-3-2-field-label',
        'bootstrap-2-3-2-field-control',
        'bootstrap-2-3-2-field-description',
        'bootstrap-2-3-2-field-error',
        'bootstrap-2-3-2-field-validity',
        'bootstrap-2-3-2-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'bootstrap-2-3-2-button' },
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-FIELD', prototypeId: 'bootstrap-2-3-2-field-root' },
        label: {
          basePrototypeId: 'P-BASE-FIELD-LABEL',
          prototypeId: 'bootstrap-2-3-2-field-label',
        },
        control: {
          basePrototypeId: 'P-BASE-FIELD-CONTROL',
          prototypeId: 'bootstrap-2-3-2-field-control',
        },
        description: {
          basePrototypeId: 'P-BASE-FIELD-DESCRIPTION',
          prototypeId: 'bootstrap-2-3-2-field-description',
        },
        error: {
          basePrototypeId: 'P-BASE-FIELD-ERROR',
          prototypeId: 'bootstrap-2-3-2-field-error',
        },
        validity: {
          basePrototypeId: 'P-BASE-FIELD-VALIDITY',
          prototypeId: 'bootstrap-2-3-2-field-validity',
        },
      },
    },
    accordion: {
      baseFamilyId: 'P-BASE-ACCORDION',
      recipeId: 'demo-bootstrap-2-3-2-accordion',
      recipePrototypeIds: [
        'bootstrap-2-3-2-accordion-root',
        'bootstrap-2-3-2-accordion-item',
        'bootstrap-2-3-2-accordion-heading',
        'bootstrap-2-3-2-accordion-trigger',
        'bootstrap-2-3-2-accordion-content',
        'bootstrap-2-3-2-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'bootstrap-2-3-2-button' },
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-ACCORDION',
          prototypeId: 'bootstrap-2-3-2-accordion-root',
        },
        item: {
          basePrototypeId: 'P-BASE-ACCORDION-ITEM',
          prototypeId: 'bootstrap-2-3-2-accordion-item',
        },
        heading: {
          basePrototypeId: 'P-BASE-ACCORDION-HEADING',
          prototypeId: 'bootstrap-2-3-2-accordion-heading',
        },
        trigger: {
          basePrototypeId: 'P-BASE-ACCORDION-TRIGGER',
          prototypeId: 'bootstrap-2-3-2-accordion-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-ACCORDION-CONTENT',
          prototypeId: 'bootstrap-2-3-2-accordion-content',
        },
      },
    },
    collapsible: {
      baseFamilyId: 'P-BASE-COLLAPSIBLE',
      recipeId: 'demo-bootstrap-2-3-2-collapsible',
      recipePrototypeIds: [
        'bootstrap-2-3-2-collapsible-root',
        'bootstrap-2-3-2-collapsible-trigger',
        'bootstrap-2-3-2-collapsible-content',
        'bootstrap-2-3-2-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'bootstrap-2-3-2-button' },
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE',
          prototypeId: 'bootstrap-2-3-2-collapsible-root',
        },
        trigger: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-TRIGGER',
          prototypeId: 'bootstrap-2-3-2-collapsible-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-CONTENT',
          prototypeId: 'bootstrap-2-3-2-collapsible-content',
        },
      },
    },
    label: {
      baseFamilyId: 'P-BASE-LABEL',
      recipeId: 'demo-bootstrap-2-3-2-label',
      recipePrototypeIds: [
        'bootstrap-2-3-2-label-root',
        'base-checkbox-root',
        'base-switch-root',
        'base-radio-group-root',
        'base-radio-group-item',
        'base-input-root',
        'base-textarea-root',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-CHECKBOX', prototypeId: 'base-checkbox-root' },
        { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'base-switch-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP', prototypeId: 'base-radio-group-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP-ITEM', prototypeId: 'base-radio-group-item' },
        { basePrototypeId: 'P-BASE-INPUT', prototypeId: 'base-input-root' },
        { basePrototypeId: 'P-BASE-TEXTAREA', prototypeId: 'base-textarea-root' },
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-LABEL', prototypeId: 'bootstrap-2-3-2-label-root' },
      },
    },
    button: {
      baseFamilyId: 'P-BASE-BUTTON',
      recipeId: 'demo-bootstrap-2-3-2-button',
      recipePrototypeIds: ['bootstrap-2-3-2-button'],
      parts: { root: { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'bootstrap-2-3-2-button' } },
    },
    'checkbox': {
      baseFamilyId: 'P-BASE-CHECKBOX',
      recipeId: 'demo-bootstrap-2-3-2-checkbox',
      recipePrototypeIds: ['bootstrap-2-3-2-checkbox-root', 'bootstrap-2-3-2-checkbox-indicator'],
      parts: {
        root: { basePrototypeId: 'P-BASE-CHECKBOX', prototypeId: 'bootstrap-2-3-2-checkbox-root' },
        indicator: {
          basePrototypeId: 'P-BASE-CHECKBOX-INDICATOR',
          prototypeId: 'bootstrap-2-3-2-checkbox-indicator',
        },
      },
    },
    'switch': {
      baseFamilyId: 'P-BASE-SWITCH',
      recipeId: 'demo-bootstrap-2-3-2-switch',
      recipePrototypeIds: ['bootstrap-2-3-2-switch-root', 'bootstrap-2-3-2-switch-thumb'],
      parts: {
        root: { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'bootstrap-2-3-2-switch-root' },
        thumb: {
          basePrototypeId: 'P-BASE-SWITCH-THUMB',
          prototypeId: 'bootstrap-2-3-2-switch-thumb',
        },
      },
    },
    'toggle': {
      baseFamilyId: 'P-BASE-TOGGLE',
      recipeId: 'demo-bootstrap-2-3-2-toggle',
      recipePrototypeIds: ['bootstrap-2-3-2-toggle'],
      parts: {
        root: { basePrototypeId: 'P-BASE-TOGGLE', prototypeId: 'bootstrap-2-3-2-toggle' },
      },
    },
    'input': {
      baseFamilyId: 'P-BASE-INPUT',
      recipeId: 'demo-bootstrap-2-3-2-input',
      recipePrototypeIds: ['bootstrap-2-3-2-input-root'],
      parts: {
        root: { basePrototypeId: 'P-BASE-INPUT', prototypeId: 'bootstrap-2-3-2-input-root' },
      },
    },
    'textarea': {
      baseFamilyId: 'P-BASE-TEXTAREA',
      recipeId: 'demo-bootstrap-2-3-2-textarea',
      recipePrototypeIds: ['bootstrap-2-3-2-textarea-root'],
      parts: {
        root: { basePrototypeId: 'P-BASE-TEXTAREA', prototypeId: 'bootstrap-2-3-2-textarea-root' },
      },
    },
    'separator': {
      baseFamilyId: 'P-BASE-SEPARATOR',
      recipeId: 'demo-bootstrap-2-3-2-separator',
      recipePrototypeIds: ['bootstrap-2-3-2-separator-root'],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-SEPARATOR',
          prototypeId: 'bootstrap-2-3-2-separator-root',
        },
      },
    },
  },
} as const satisfies ProjectionFamilyManifest;

const LIQUID_GLASS_MANIFEST = {
  projectionFamilyId: 'liquid-glass',
  themeArtifactId: 'prototype-liquid-glass-theme',
  themeInputId: 'website-liquid-glass-theme-mode',
  // Partial by design: no missing kind may borrow an implementation.
  families: {
    text: {
      baseFamilyId: 'P-BASE-TEXT',
      recipeId: 'demo-liquid-glass-text',
      recipePrototypeIds: ['liquid-glass-text-root'],
      parts: { root: { basePrototypeId: 'P-BASE-TEXT', prototypeId: 'liquid-glass-text-root' } },
    },
    tabs: {
      baseFamilyId: 'P-BASE-TABS',
      recipeId: 'demo-liquid-glass-tabs',
      recipePrototypeIds: [
        'liquid-glass-tabs-root',
        'liquid-glass-tabs-list',
        'liquid-glass-tabs-trigger',
        'liquid-glass-tabs-content',
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-TABS', prototypeId: 'liquid-glass-tabs-root' },
        list: { basePrototypeId: 'P-BASE-TABS-LIST', prototypeId: 'liquid-glass-tabs-list' },
        trigger: {
          basePrototypeId: 'P-BASE-TABS-TRIGGER',
          prototypeId: 'liquid-glass-tabs-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-TABS-CONTENT',
          prototypeId: 'liquid-glass-tabs-content',
        },
      },
    },
    select: {
      baseFamilyId: 'P-BASE-SELECT',
      recipeId: 'demo-liquid-glass-select',
      recipePrototypeIds: [
        'liquid-glass-select-root',
        'liquid-glass-select-trigger',
        'liquid-glass-select-value',
        'liquid-glass-select-content',
        'liquid-glass-select-item',
        'liquid-glass-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'liquid-glass-button' },
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-SELECT', prototypeId: 'liquid-glass-select-root' },
        trigger: {
          basePrototypeId: 'P-BASE-SELECT-TRIGGER',
          prototypeId: 'liquid-glass-select-trigger',
        },
        value: { basePrototypeId: 'P-BASE-SELECT-VALUE', prototypeId: 'liquid-glass-select-value' },
        content: {
          basePrototypeId: 'P-BASE-SELECT-CONTENT',
          prototypeId: 'liquid-glass-select-content',
        },
        item: { basePrototypeId: 'P-BASE-SELECT-ITEM', prototypeId: 'liquid-glass-select-item' },
      },
    },
    field: {
      baseFamilyId: 'P-BASE-FIELD',
      recipeId: 'demo-liquid-glass-field',
      recipePrototypeIds: [
        'liquid-glass-field-root',
        'liquid-glass-field-label',
        'liquid-glass-field-control',
        'liquid-glass-field-description',
        'liquid-glass-field-error',
        'liquid-glass-field-validity',
        'liquid-glass-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'liquid-glass-button' },
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-FIELD', prototypeId: 'liquid-glass-field-root' },
        label: { basePrototypeId: 'P-BASE-FIELD-LABEL', prototypeId: 'liquid-glass-field-label' },
        control: {
          basePrototypeId: 'P-BASE-FIELD-CONTROL',
          prototypeId: 'liquid-glass-field-control',
        },
        description: {
          basePrototypeId: 'P-BASE-FIELD-DESCRIPTION',
          prototypeId: 'liquid-glass-field-description',
        },
        error: { basePrototypeId: 'P-BASE-FIELD-ERROR', prototypeId: 'liquid-glass-field-error' },
        validity: {
          basePrototypeId: 'P-BASE-FIELD-VALIDITY',
          prototypeId: 'liquid-glass-field-validity',
        },
      },
    },
    accordion: {
      baseFamilyId: 'P-BASE-ACCORDION',
      recipeId: 'demo-liquid-glass-accordion',
      recipePrototypeIds: [
        'liquid-glass-accordion-root',
        'liquid-glass-accordion-item',
        'liquid-glass-accordion-heading',
        'liquid-glass-accordion-trigger',
        'liquid-glass-accordion-content',
        'liquid-glass-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'liquid-glass-button' },
      ],
      parts: {
        root: { basePrototypeId: 'P-BASE-ACCORDION', prototypeId: 'liquid-glass-accordion-root' },
        item: {
          basePrototypeId: 'P-BASE-ACCORDION-ITEM',
          prototypeId: 'liquid-glass-accordion-item',
        },
        heading: {
          basePrototypeId: 'P-BASE-ACCORDION-HEADING',
          prototypeId: 'liquid-glass-accordion-heading',
        },
        trigger: {
          basePrototypeId: 'P-BASE-ACCORDION-TRIGGER',
          prototypeId: 'liquid-glass-accordion-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-ACCORDION-CONTENT',
          prototypeId: 'liquid-glass-accordion-content',
        },
      },
    },
    collapsible: {
      baseFamilyId: 'P-BASE-COLLAPSIBLE',
      recipeId: 'demo-liquid-glass-collapsible',
      recipePrototypeIds: [
        'liquid-glass-collapsible-root',
        'liquid-glass-collapsible-trigger',
        'liquid-glass-collapsible-content',
        'liquid-glass-button',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'liquid-glass-button' },
      ],
      parts: {
        root: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE',
          prototypeId: 'liquid-glass-collapsible-root',
        },
        trigger: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-TRIGGER',
          prototypeId: 'liquid-glass-collapsible-trigger',
        },
        content: {
          basePrototypeId: 'P-BASE-COLLAPSIBLE-CONTENT',
          prototypeId: 'liquid-glass-collapsible-content',
        },
      },
    },
    label: {
      baseFamilyId: 'P-BASE-LABEL',
      recipeId: 'demo-liquid-glass-label',
      recipePrototypeIds: [
        'liquid-glass-label-root',
        'base-checkbox-root',
        'base-switch-root',
        'base-radio-group-root',
        'base-radio-group-item',
        'base-input-root',
        'base-textarea-root',
      ],
      auxiliaryPrototypes: [
        { basePrototypeId: 'P-BASE-CHECKBOX', prototypeId: 'base-checkbox-root' },
        { basePrototypeId: 'P-BASE-SWITCH', prototypeId: 'base-switch-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP', prototypeId: 'base-radio-group-root' },
        { basePrototypeId: 'P-BASE-RADIO-GROUP-ITEM', prototypeId: 'base-radio-group-item' },
        { basePrototypeId: 'P-BASE-INPUT', prototypeId: 'base-input-root' },
        { basePrototypeId: 'P-BASE-TEXTAREA', prototypeId: 'base-textarea-root' },
      ],
      parts: { root: { basePrototypeId: 'P-BASE-LABEL', prototypeId: 'liquid-glass-label-root' } },
    },
    button: {
      baseFamilyId: 'P-BASE-BUTTON',
      recipeId: 'demo-liquid-glass-button',
      recipePrototypeIds: ['liquid-glass-button'],
      parts: { root: { basePrototypeId: 'P-BASE-BUTTON', prototypeId: 'liquid-glass-button' } },
    },
  },
} as const satisfies ProjectionFamilyManifest;

export const PROJECTION_FAMILY_MANIFESTS = Object.freeze({
  shadcn: SHADCN_MANIFEST,
  brutalist: BRUTALIST_MANIFEST,
  'bootstrap-2-3-2': BOOTSTRAP_232_MANIFEST,
  'liquid-glass': LIQUID_GLASS_MANIFEST,
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
    const auxiliaryPrototypes = family.auxiliaryPrototypes ?? [];
    const expectedAuxiliaryPrototypes = expectedFamily.auxiliaryPrototypes ?? [];
    const partPrototypeIds = new Set(Object.values(family.parts).map((part) => part.prototypeId));
    if (
      !Array.isArray(auxiliaryPrototypes) ||
      new Set(auxiliaryPrototypes.map((prototype) => prototype.prototypeId)).size !==
        auxiliaryPrototypes.length ||
      auxiliaryPrototypes.some(
        (prototype) =>
          !prototype ||
          typeof prototype !== 'object' ||
          typeof prototype.prototypeId !== 'string' ||
          !hasOwn(prototype, 'basePrototypeId') ||
          (prototype.basePrototypeId !== null && typeof prototype.basePrototypeId !== 'string') ||
          partPrototypeIds.has(prototype.prototypeId)
      ) ||
      auxiliaryPrototypes.length !== expectedAuxiliaryPrototypes.length ||
      expectedAuxiliaryPrototypes.some(
        (expected, index) =>
          auxiliaryPrototypes[index]?.prototypeId !== expected.prototypeId ||
          auxiliaryPrototypes[index]?.basePrototypeId !== expected.basePrototypeId
      )
    ) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has invalid auxiliary Prototype lineage.`
      );
    }
    const classifiedPrototypeIds = new Set([
      ...partPrototypeIds,
      ...auxiliaryPrototypes.map((prototype) => prototype.prototypeId),
    ]);
    if (
      classifiedPrototypeIds.size !== actualRecipePrototypeIds.length ||
      actualRecipePrototypeIds.some((prototypeId) => !classifiedPrototypeIds.has(prototypeId))
    ) {
      throw new Error(
        `[PrototypePreviewer] projection family ${projectionFamilyId} family ${familyId} has invalid auxiliary Prototype lineage.`
      );
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
