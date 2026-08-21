import { SHADCN_COMPONENT_PRESET_RECIPES } from './shadcn-component-presets.generated.js';

export interface ComponentItem {
  prototypeImport: string;
  reactExport: string;
  vueExport: string;
  wcExport: string;
  elementName: string;
}

export interface ComponentEntry {
  id: string;
  label: string;
  packageName: string;
  importPath: string;
  stylePreset: string | null;
  items: ComponentItem[];
  preset?: ComponentPreset;
}

export interface ComponentPreset {
  readonly kind: 'replaceable-default-part';
  readonly placement: 'direct-child';
  readonly exportName: string;
  readonly rootExport: string;
  readonly defaultPartExport: string;
  readonly defaultPartElementName: string;
  readonly inputName: string;
  readonly elementName: string;
  readonly omissionAttribute: string;
}

interface ComponentPresetRecipe {
  readonly kind: 'replaceable-default-part';
  readonly placement: 'direct-child';
  readonly exportName: string;
  readonly rootPrototype: string;
  readonly defaultPartPrototype: string;
  readonly inputName: string;
  readonly elementName: string;
  readonly omissionAttribute: string;
}

function defineSimple(
  id: string,
  label: string,
  packageName: string,
  importPath: string,
  prototypeImport: string,
  exportBaseName: string,
  options: { stylePreset?: string | null; elementName?: string } = {}
): ComponentEntry {
  return {
    id,
    label,
    packageName,
    importPath,
    stylePreset: options.stylePreset ?? null,
    items: [
      createItem({
        prototypeImport,
        exportBaseName,
        elementName: options.elementName ?? `proto-ui-${id}`,
      }),
    ],
  };
}

function defineCompound(
  id: string,
  label: string,
  packageName: string,
  importPath: string,
  parts: { prototypeImport: string; exportBaseName: string; elementName: string }[],
  options: { stylePreset?: string | null; preset?: ComponentPresetRecipe } = {}
): ComponentEntry {
  const items = parts.map((part) =>
    createItem({
      prototypeImport: part.prototypeImport,
      exportBaseName: part.exportBaseName,
      elementName: part.elementName,
    })
  );
  return {
    id,
    label,
    packageName,
    importPath,
    stylePreset: options.stylePreset ?? null,
    items,
    preset: options.preset ? resolveComponentPreset(items, options.preset) : undefined,
  };
}

function resolveComponentPreset(
  items: ComponentItem[],
  recipe: ComponentPresetRecipe
): ComponentPreset {
  const root = items.find((item) => item.prototypeImport === recipe.rootPrototype);
  const defaultPart = items.find((item) => item.prototypeImport === recipe.defaultPartPrototype);
  if (!root || !defaultPart) {
    throw new Error(
      `[component-registry] preset ${recipe.exportName} references prototypes missing from its component entry.`
    );
  }
  return {
    kind: recipe.kind,
    placement: recipe.placement,
    exportName: recipe.exportName,
    rootExport: root.reactExport,
    defaultPartExport: defaultPart.reactExport,
    defaultPartElementName: defaultPart.elementName,
    inputName: recipe.inputName,
    elementName: recipe.elementName,
    omissionAttribute: recipe.omissionAttribute,
  };
}

function createItem({
  prototypeImport,
  exportBaseName,
  elementName,
}: {
  prototypeImport: string;
  exportBaseName: string;
  elementName: string;
}): ComponentItem {
  return {
    prototypeImport,
    reactExport: exportBaseName,
    vueExport: exportBaseName,
    wcExport: `${exportBaseName}Element`,
    elementName,
  };
}

const shadcn = (id: string, label: string, prototypeImport: string, exportBaseName: string) =>
  defineSimple(
    id,
    label,
    '@proto.ui/prototypes-shadcn',
    `@proto.ui/prototypes-shadcn/${id.slice('shadcn-'.length)}`,
    prototypeImport,
    exportBaseName,
    { stylePreset: 'shadcn' }
  );

const shadcnCompound = (
  id: string,
  label: string,
  parts: { prototypeImport: string; exportBaseName: string; elementName: string }[],
  preset?: ComponentPresetRecipe
) =>
  defineCompound(
    id,
    label,
    '@proto.ui/prototypes-shadcn',
    `@proto.ui/prototypes-shadcn/${id.slice('shadcn-'.length)}`,
    parts,
    { stylePreset: 'shadcn', preset }
  );

const brutalist = (id: string, label: string, prototypeImport: string, exportBaseName: string) =>
  defineSimple(
    id,
    label,
    '@proto.ui/prototypes-brutalist',
    `@proto.ui/prototypes-brutalist/${id.slice('brutalist-'.length)}`,
    prototypeImport,
    exportBaseName,
    { stylePreset: 'brutalist' }
  );

const brutalistCompound = (
  id: string,
  label: string,
  parts: { prototypeImport: string; exportBaseName: string; elementName: string }[]
) =>
  defineCompound(
    id,
    label,
    '@proto.ui/prototypes-brutalist',
    `@proto.ui/prototypes-brutalist/${id.slice('brutalist-'.length)}`,
    parts,
    { stylePreset: 'brutalist' }
  );

const base = (id: string, label: string, prototypeImport: string, exportBaseName: string) =>
  defineSimple(
    id,
    label,
    '@proto.ui/prototypes-base',
    `@proto.ui/prototypes-base/${id.slice('base-'.length)}`,
    prototypeImport,
    exportBaseName
  );

const baseCompound = (
  id: string,
  label: string,
  parts: { prototypeImport: string; exportBaseName: string; elementName: string }[]
) =>
  defineCompound(
    id,
    label,
    '@proto.ui/prototypes-base',
    `@proto.ui/prototypes-base/${id.slice('base-'.length)}`,
    parts
  );

export const COMPONENT_REGISTRY: Record<string, ComponentEntry> = {
  'shadcn-button': shadcn('shadcn-button', 'shadcn Button', 'shadcnButton', 'ShadcnButton'),
  'shadcn-toggle': shadcn('shadcn-toggle', 'shadcn Toggle', 'shadcnToggle', 'ShadcnToggle'),
  'shadcn-separator': shadcn(
    'shadcn-separator',
    'shadcn Separator',
    'shadcnSeparatorRoot',
    'ShadcnSeparatorRoot'
  ),

  'shadcn-textarea': shadcn(
    'shadcn-textarea',
    'shadcn Textarea',
    'shadcnTextareaRoot',
    'ShadcnTextareaRoot'
  ),

  'shadcn-checkbox': shadcnCompound(
    'shadcn-checkbox',
    'shadcn Checkbox',
    [
      {
        prototypeImport: 'shadcnCheckboxRoot',
        exportBaseName: 'ShadcnCheckboxRoot',
        elementName: 'proto-ui-shadcn-checkbox-root',
      },
      {
        prototypeImport: 'shadcnCheckboxIndicator',
        exportBaseName: 'ShadcnCheckboxIndicator',
        elementName: 'proto-ui-shadcn-checkbox-indicator',
      },
    ],
    SHADCN_COMPONENT_PRESET_RECIPES['shadcn-checkbox']
  ),

  'shadcn-switch': shadcnCompound(
    'shadcn-switch',
    'shadcn Switch',
    [
      {
        prototypeImport: 'shadcnSwitchRoot',
        exportBaseName: 'ShadcnSwitchRoot',
        elementName: 'proto-ui-shadcn-switch-root',
      },
      {
        prototypeImport: 'shadcnSwitchThumb',
        exportBaseName: 'ShadcnSwitchThumb',
        elementName: 'proto-ui-shadcn-switch-thumb',
      },
    ],
    SHADCN_COMPONENT_PRESET_RECIPES['shadcn-switch']
  ),

  'shadcn-tabs': shadcnCompound('shadcn-tabs', 'shadcn Tabs', [
    {
      prototypeImport: 'shadcnTabsRoot',
      exportBaseName: 'ShadcnTabsRoot',
      elementName: 'proto-ui-shadcn-tabs-root',
    },
    {
      prototypeImport: 'shadcnTabsList',
      exportBaseName: 'ShadcnTabsList',
      elementName: 'proto-ui-shadcn-tabs-list',
    },
    {
      prototypeImport: 'shadcnTabsTrigger',
      exportBaseName: 'ShadcnTabsTrigger',
      elementName: 'proto-ui-shadcn-tabs-trigger',
    },
    {
      prototypeImport: 'shadcnTabsContent',
      exportBaseName: 'ShadcnTabsContent',
      elementName: 'proto-ui-shadcn-tabs-content',
    },
  ]),

  'shadcn-hover-card': shadcnCompound('shadcn-hover-card', 'shadcn Hover Card', [
    {
      prototypeImport: 'shadcnHoverCardRoot',
      exportBaseName: 'ShadcnHoverCardRoot',
      elementName: 'proto-ui-shadcn-hover-card-root',
    },
    {
      prototypeImport: 'shadcnHoverCardTrigger',
      exportBaseName: 'ShadcnHoverCardTrigger',
      elementName: 'proto-ui-shadcn-hover-card-trigger',
    },
    {
      prototypeImport: 'shadcnHoverCardContent',
      exportBaseName: 'ShadcnHoverCardContent',
      elementName: 'proto-ui-shadcn-hover-card-content',
    },
  ]),

  'shadcn-dropdown': shadcnCompound('shadcn-dropdown', 'shadcn Dropdown', [
    {
      prototypeImport: 'shadcnDropdownRoot',
      exportBaseName: 'ShadcnDropdownRoot',
      elementName: 'proto-ui-shadcn-dropdown-root',
    },
    {
      prototypeImport: 'shadcnDropdownTrigger',
      exportBaseName: 'ShadcnDropdownTrigger',
      elementName: 'proto-ui-shadcn-dropdown-trigger',
    },
    {
      prototypeImport: 'shadcnDropdownContent',
      exportBaseName: 'ShadcnDropdownContent',
      elementName: 'proto-ui-shadcn-dropdown-content',
    },
    {
      prototypeImport: 'shadcnDropdownItem',
      exportBaseName: 'ShadcnDropdownItem',
      elementName: 'proto-ui-shadcn-dropdown-item',
    },
  ]),

  'shadcn-select': shadcnCompound('shadcn-select', 'shadcn Select', [
    {
      prototypeImport: 'shadcnSelectRoot',
      exportBaseName: 'ShadcnSelectRoot',
      elementName: 'proto-ui-shadcn-select-root',
    },
    {
      prototypeImport: 'shadcnSelectTrigger',
      exportBaseName: 'ShadcnSelectTrigger',
      elementName: 'proto-ui-shadcn-select-trigger',
    },
    {
      prototypeImport: 'shadcnSelectValue',
      exportBaseName: 'ShadcnSelectValue',
      elementName: 'proto-ui-shadcn-select-value',
    },
    {
      prototypeImport: 'shadcnSelectContent',
      exportBaseName: 'ShadcnSelectContent',
      elementName: 'proto-ui-shadcn-select-content',
    },
    {
      prototypeImport: 'shadcnSelectItem',
      exportBaseName: 'ShadcnSelectItem',
      elementName: 'proto-ui-shadcn-select-item',
    },
  ]),

  'shadcn-dialog': shadcnCompound(
    'shadcn-dialog',
    'shadcn Dialog',
    [
      {
        prototypeImport: 'shadcnDialogRoot',
        exportBaseName: 'ShadcnDialogRoot',
        elementName: 'proto-ui-shadcn-dialog-root',
      },
      {
        prototypeImport: 'shadcnDialogTrigger',
        exportBaseName: 'ShadcnDialogTrigger',
        elementName: 'proto-ui-shadcn-dialog-trigger',
      },
      {
        prototypeImport: 'shadcnDialogMask',
        exportBaseName: 'ShadcnDialogMask',
        elementName: 'proto-ui-shadcn-dialog-mask',
      },
      {
        prototypeImport: 'shadcnDialogContent',
        exportBaseName: 'ShadcnDialogContentRaw',
        elementName: 'proto-ui-shadcn-dialog-content-raw',
      },
      {
        prototypeImport: 'shadcnDialogTitle',
        exportBaseName: 'ShadcnDialogTitle',
        elementName: 'proto-ui-shadcn-dialog-title',
      },
      {
        prototypeImport: 'shadcnDialogDescription',
        exportBaseName: 'ShadcnDialogDescription',
        elementName: 'proto-ui-shadcn-dialog-description',
      },
      {
        prototypeImport: 'shadcnDialogClose',
        exportBaseName: 'ShadcnDialogClose',
        elementName: 'proto-ui-shadcn-dialog-close',
      },
      {
        prototypeImport: 'shadcnDialogCloseIcon',
        exportBaseName: 'ShadcnDialogCloseIcon',
        elementName: 'proto-ui-shadcn-dialog-close-icon',
      },
      {
        prototypeImport: 'shadcnDialogHeader',
        exportBaseName: 'ShadcnDialogHeader',
        elementName: 'proto-ui-shadcn-dialog-header',
      },
      {
        prototypeImport: 'shadcnDialogFooter',
        exportBaseName: 'ShadcnDialogFooter',
        elementName: 'proto-ui-shadcn-dialog-footer',
      },
    ],
    SHADCN_COMPONENT_PRESET_RECIPES['shadcn-dialog']
  ),

  'brutalist-button': brutalist(
    'brutalist-button',
    'Brutalist Button',
    'brutalistButton',
    'BrutalistButton'
  ),
  'brutalist-badge': brutalist(
    'brutalist-badge',
    'Brutalist Badge',
    'brutalistBadgeRoot',
    'BrutalistBadgeRoot'
  ),
  'brutalist-toggle': brutalist(
    'brutalist-toggle',
    'Brutalist Toggle',
    'brutalistToggle',
    'BrutalistToggle'
  ),
  'brutalist-separator': brutalist(
    'brutalist-separator',
    'Brutalist Separator',
    'brutalistSeparatorRoot',
    'BrutalistSeparatorRoot'
  ),
  'brutalist-skeleton': brutalist(
    'brutalist-skeleton',
    'Brutalist Skeleton',
    'brutalistSkeletonRoot',
    'BrutalistSkeletonRoot'
  ),
  'brutalist-textarea': brutalist(
    'brutalist-textarea',
    'Brutalist Textarea',
    'brutalistTextareaRoot',
    'BrutalistTextareaRoot'
  ),
  'brutalist-card': brutalistCompound('brutalist-card', 'Brutalist Card', [
    {
      prototypeImport: 'brutalistCardRoot',
      exportBaseName: 'BrutalistCardRoot',
      elementName: 'proto-ui-brutalist-card-root',
    },
    {
      prototypeImport: 'brutalistCardHeader',
      exportBaseName: 'BrutalistCardHeader',
      elementName: 'proto-ui-brutalist-card-header',
    },
    {
      prototypeImport: 'brutalistCardContent',
      exportBaseName: 'BrutalistCardContent',
      elementName: 'proto-ui-brutalist-card-content',
    },
    {
      prototypeImport: 'brutalistCardFooter',
      exportBaseName: 'BrutalistCardFooter',
      elementName: 'proto-ui-brutalist-card-footer',
    },
  ]),

  'brutalist-switch': brutalistCompound('brutalist-switch', 'Brutalist Switch', [
    {
      prototypeImport: 'brutalistSwitchRoot',
      exportBaseName: 'BrutalistSwitchRoot',
      elementName: 'proto-ui-brutalist-switch-root',
    },
    {
      prototypeImport: 'brutalistSwitchThumb',
      exportBaseName: 'BrutalistSwitchThumb',
      elementName: 'proto-ui-brutalist-switch-thumb',
    },
  ]),

  'brutalist-tabs': brutalistCompound('brutalist-tabs', 'Brutalist Tabs', [
    {
      prototypeImport: 'brutalistTabsRoot',
      exportBaseName: 'BrutalistTabsRoot',
      elementName: 'proto-ui-brutalist-tabs-root',
    },
    {
      prototypeImport: 'brutalistTabsList',
      exportBaseName: 'BrutalistTabsList',
      elementName: 'proto-ui-brutalist-tabs-list',
    },
    {
      prototypeImport: 'brutalistTabsTrigger',
      exportBaseName: 'BrutalistTabsTrigger',
      elementName: 'proto-ui-brutalist-tabs-trigger',
    },
    {
      prototypeImport: 'brutalistTabsContent',
      exportBaseName: 'BrutalistTabsContent',
      elementName: 'proto-ui-brutalist-tabs-content',
    },
  ]),

  'brutalist-hover-card': brutalistCompound('brutalist-hover-card', 'Brutalist Hover Card', [
    {
      prototypeImport: 'brutalistHoverCardRoot',
      exportBaseName: 'BrutalistHoverCardRoot',
      elementName: 'proto-ui-brutalist-hover-card-root',
    },
    {
      prototypeImport: 'brutalistHoverCardTrigger',
      exportBaseName: 'BrutalistHoverCardTrigger',
      elementName: 'proto-ui-brutalist-hover-card-trigger',
    },
    {
      prototypeImport: 'brutalistHoverCardContent',
      exportBaseName: 'BrutalistHoverCardContent',
      elementName: 'proto-ui-brutalist-hover-card-content',
    },
  ]),

  'brutalist-dropdown': brutalistCompound('brutalist-dropdown', 'Brutalist Dropdown', [
    {
      prototypeImport: 'brutalistDropdownRoot',
      exportBaseName: 'BrutalistDropdownRoot',
      elementName: 'proto-ui-brutalist-dropdown-root',
    },
    {
      prototypeImport: 'brutalistDropdownTrigger',
      exportBaseName: 'BrutalistDropdownTrigger',
      elementName: 'proto-ui-brutalist-dropdown-trigger',
    },
    {
      prototypeImport: 'brutalistDropdownContent',
      exportBaseName: 'BrutalistDropdownContent',
      elementName: 'proto-ui-brutalist-dropdown-content',
    },
    {
      prototypeImport: 'brutalistDropdownItem',
      exportBaseName: 'BrutalistDropdownItem',
      elementName: 'proto-ui-brutalist-dropdown-item',
    },
  ]),

  'brutalist-select': brutalistCompound('brutalist-select', 'Brutalist Select', [
    {
      prototypeImport: 'brutalistSelectRoot',
      exportBaseName: 'BrutalistSelectRoot',
      elementName: 'proto-ui-brutalist-select-root',
    },
    {
      prototypeImport: 'brutalistSelectTrigger',
      exportBaseName: 'BrutalistSelectTrigger',
      elementName: 'proto-ui-brutalist-select-trigger',
    },
    {
      prototypeImport: 'brutalistSelectValue',
      exportBaseName: 'BrutalistSelectValue',
      elementName: 'proto-ui-brutalist-select-value',
    },
    {
      prototypeImport: 'brutalistSelectContent',
      exportBaseName: 'BrutalistSelectContent',
      elementName: 'proto-ui-brutalist-select-content',
    },
    {
      prototypeImport: 'brutalistSelectItem',
      exportBaseName: 'BrutalistSelectItem',
      elementName: 'proto-ui-brutalist-select-item',
    },
  ]),

  'brutalist-dialog': brutalistCompound('brutalist-dialog', 'Brutalist Dialog', [
    {
      prototypeImport: 'brutalistDialogRoot',
      exportBaseName: 'BrutalistDialogRoot',
      elementName: 'proto-ui-brutalist-dialog-root',
    },
    {
      prototypeImport: 'brutalistDialogTrigger',
      exportBaseName: 'BrutalistDialogTrigger',
      elementName: 'proto-ui-brutalist-dialog-trigger',
    },
    {
      prototypeImport: 'brutalistDialogMask',
      exportBaseName: 'BrutalistDialogMask',
      elementName: 'proto-ui-brutalist-dialog-mask',
    },
    {
      prototypeImport: 'brutalistDialogContent',
      exportBaseName: 'BrutalistDialogContent',
      elementName: 'proto-ui-brutalist-dialog-content',
    },
    {
      prototypeImport: 'brutalistDialogTitle',
      exportBaseName: 'BrutalistDialogTitle',
      elementName: 'proto-ui-brutalist-dialog-title',
    },
    {
      prototypeImport: 'brutalistDialogDescription',
      exportBaseName: 'BrutalistDialogDescription',
      elementName: 'proto-ui-brutalist-dialog-description',
    },
    {
      prototypeImport: 'brutalistDialogClose',
      exportBaseName: 'BrutalistDialogClose',
      elementName: 'proto-ui-brutalist-dialog-close',
    },
    {
      prototypeImport: 'brutalistDialogCloseIcon',
      exportBaseName: 'BrutalistDialogCloseIcon',
      elementName: 'proto-ui-brutalist-dialog-close-icon',
    },
    {
      prototypeImport: 'brutalistDialogHeader',
      exportBaseName: 'BrutalistDialogHeader',
      elementName: 'proto-ui-brutalist-dialog-header',
    },
    {
      prototypeImport: 'brutalistDialogFooter',
      exportBaseName: 'BrutalistDialogFooter',
      elementName: 'proto-ui-brutalist-dialog-footer',
    },
  ]),

  'brutalist-scroll-area': brutalistCompound('brutalist-scroll-area', 'Brutalist Scroll Area', [
    {
      prototypeImport: 'brutalistScrollAreaRoot',
      exportBaseName: 'BrutalistScrollAreaRoot',
      elementName: 'proto-ui-brutalist-scroll-area-root',
    },
    {
      prototypeImport: 'brutalistScrollAreaViewport',
      exportBaseName: 'BrutalistScrollAreaViewport',
      elementName: 'proto-ui-brutalist-scroll-area-viewport',
    },
    {
      prototypeImport: 'brutalistScrollAreaScrollbar',
      exportBaseName: 'BrutalistScrollAreaScrollbar',
      elementName: 'proto-ui-brutalist-scroll-area-scrollbar',
    },
    {
      prototypeImport: 'brutalistScrollAreaThumb',
      exportBaseName: 'BrutalistScrollAreaThumb',
      elementName: 'proto-ui-brutalist-scroll-area-thumb',
    },
  ]),

  'base-button': base('base-button', 'base Button', 'button', 'BaseButton'),
  'base-toggle': base('base-toggle', 'base Toggle', 'toggle', 'BaseToggle'),
  'base-transition': base('base-transition', 'base Transition', 'transition', 'BaseTransition'),
  'base-textarea': base('base-textarea', 'Base Textarea', 'textareaRoot', 'BaseTextareaRoot'),

  'base-switch': baseCompound('base-switch', 'base Switch', [
    {
      prototypeImport: 'switchRoot',
      exportBaseName: 'BaseSwitchRoot',
      elementName: 'proto-ui-base-switch-root',
    },
    {
      prototypeImport: 'switchThumb',
      exportBaseName: 'BaseSwitchThumb',
      elementName: 'proto-ui-base-switch-thumb',
    },
  ]),

  'base-tabs': baseCompound('base-tabs', 'base Tabs', [
    {
      prototypeImport: 'tabsRoot',
      exportBaseName: 'BaseTabsRoot',
      elementName: 'proto-ui-base-tabs-root',
    },
    {
      prototypeImport: 'tabsList',
      exportBaseName: 'BaseTabsList',
      elementName: 'proto-ui-base-tabs-list',
    },
    {
      prototypeImport: 'tabsTrigger',
      exportBaseName: 'BaseTabsTrigger',
      elementName: 'proto-ui-base-tabs-trigger',
    },
    {
      prototypeImport: 'tabsContent',
      exportBaseName: 'BaseTabsContent',
      elementName: 'proto-ui-base-tabs-content',
    },
  ]),

  'base-radio-group': baseCompound('base-radio-group', 'Base Radio Group', [
    {
      prototypeImport: 'radioGroupRoot',
      exportBaseName: 'BaseRadioGroupRoot',
      elementName: 'proto-ui-base-radio-group-root',
    },
    {
      prototypeImport: 'radioGroupItem',
      exportBaseName: 'BaseRadioGroupItem',
      elementName: 'proto-ui-base-radio-group-item',
    },
    {
      prototypeImport: 'radioGroupIndicator',
      exportBaseName: 'BaseRadioGroupIndicator',
      elementName: 'proto-ui-base-radio-group-indicator',
    },
  ]),

  'base-dropdown': baseCompound('base-dropdown', 'base Dropdown', [
    {
      prototypeImport: 'dropdownRoot',
      exportBaseName: 'BaseDropdownRoot',
      elementName: 'proto-ui-base-dropdown-root',
    },
    {
      prototypeImport: 'dropdownTrigger',
      exportBaseName: 'BaseDropdownTrigger',
      elementName: 'proto-ui-base-dropdown-trigger',
    },
    {
      prototypeImport: 'dropdownContent',
      exportBaseName: 'BaseDropdownContent',
      elementName: 'proto-ui-base-dropdown-content',
    },
    {
      prototypeImport: 'dropdownItem',
      exportBaseName: 'BaseDropdownItem',
      elementName: 'proto-ui-base-dropdown-item',
    },
  ]),

  'base-select': baseCompound('base-select', 'base Select', [
    {
      prototypeImport: 'selectRoot',
      exportBaseName: 'BaseSelectRoot',
      elementName: 'proto-ui-base-select-root',
    },
    {
      prototypeImport: 'selectTrigger',
      exportBaseName: 'BaseSelectTrigger',
      elementName: 'proto-ui-base-select-trigger',
    },
    {
      prototypeImport: 'selectValue',
      exportBaseName: 'BaseSelectValue',
      elementName: 'proto-ui-base-select-value',
    },
    {
      prototypeImport: 'selectContent',
      exportBaseName: 'BaseSelectContent',
      elementName: 'proto-ui-base-select-content',
    },
    {
      prototypeImport: 'selectItem',
      exportBaseName: 'BaseSelectItem',
      elementName: 'proto-ui-base-select-item',
    },
  ]),

  'base-hover-card': baseCompound('base-hover-card', 'base Hover Card', [
    {
      prototypeImport: 'hoverCardRoot',
      exportBaseName: 'BaseHoverCardRoot',
      elementName: 'proto-ui-base-hover-card-root',
    },
    {
      prototypeImport: 'hoverCardTrigger',
      exportBaseName: 'BaseHoverCardTrigger',
      elementName: 'proto-ui-base-hover-card-trigger',
    },
    {
      prototypeImport: 'hoverCardContent',
      exportBaseName: 'BaseHoverCardContent',
      elementName: 'proto-ui-base-hover-card-content',
    },
  ]),

  'base-separator': base('base-separator', 'Base Separator', 'separatorRoot', 'BaseSeparatorRoot'),
  'base-live-region': base(
    'base-live-region',
    'Base Live Region',
    'liveRegionRoot',
    'BaseLiveRegionRoot'
  ),
  'base-async-region': base(
    'base-async-region',
    'Base Async Region',
    'asyncRegionRoot',
    'BaseAsyncRegionRoot'
  ),
  'base-dialog': baseCompound('base-dialog', 'base Dialog', [
    {
      prototypeImport: 'dialogRoot',
      exportBaseName: 'BaseDialogRoot',
      elementName: 'proto-ui-base-dialog-root',
    },
    {
      prototypeImport: 'dialogTrigger',
      exportBaseName: 'BaseDialogTrigger',
      elementName: 'proto-ui-base-dialog-trigger',
    },
    {
      prototypeImport: 'dialogMask',
      exportBaseName: 'BaseDialogMask',
      elementName: 'proto-ui-base-dialog-mask',
    },
    {
      prototypeImport: 'dialogContent',
      exportBaseName: 'BaseDialogContent',
      elementName: 'proto-ui-base-dialog-content',
    },
    {
      prototypeImport: 'dialogTitle',
      exportBaseName: 'BaseDialogTitle',
      elementName: 'proto-ui-base-dialog-title',
    },
    {
      prototypeImport: 'dialogDescription',
      exportBaseName: 'BaseDialogDescription',
      elementName: 'proto-ui-base-dialog-description',
    },
    {
      prototypeImport: 'dialogClose',
      exportBaseName: 'BaseDialogClose',
      elementName: 'proto-ui-base-dialog-close',
    },
  ]),
};

export function getComponentEntry(componentId: string | undefined): ComponentEntry | null {
  if (!componentId) return null;
  return COMPONENT_REGISTRY[componentId] ?? null;
}

export function listComponentChoices(): { title: string; value: string }[] {
  return Object.values(COMPONENT_REGISTRY)
    .map((entry) => ({
      title: entry.label,
      value: entry.id,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}
