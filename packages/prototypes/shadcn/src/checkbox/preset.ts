import type { ShadcnComponentPresetRecipe } from '../component-presets.types';

/**
 * Component-local composition recipe for the Shadcn Checkbox convenience facade.
 * Visual tokens remain owned by the referenced Root and Indicator prototypes.
 */
export const shadcnCheckboxComponentPreset = {
  kind: 'replaceable-default-part',
  placement: 'direct-child',
  exportName: 'ShadcnCheckbox',
  rootPrototype: 'shadcnCheckboxRoot',
  defaultPartPrototype: 'shadcnCheckboxIndicator',
  inputName: 'indicator',
  elementName: 'proto-ui-shadcn-checkbox',
  omissionAttribute: 'data-pui-no-default-indicator',
} as const satisfies ShadcnComponentPresetRecipe;

export default shadcnCheckboxComponentPreset;
