import { shadcnCheckboxComponentPreset } from './checkbox/preset';
import { shadcnDialogComponentPreset } from './dialog/preset';
import { shadcnSwitchComponentPreset } from './switch/preset';
import type { ShadcnComponentPresetRecipe } from './component-presets.types';

export type { ShadcnComponentPresetRecipe } from './component-presets.types';
export { shadcnCheckboxComponentPreset, shadcnDialogComponentPreset, shadcnSwitchComponentPreset };

/**
 * Aggregate surface for prototype-library-owned composition recipes.
 *
 * Each recipe is authored beside its component prototypes. Recipes declare
 * part identity and replacement policy only. Host facade names for the
 * referenced prototypes remain adapter/CLI registry concerns, and all visual
 * tokens remain owned by the referenced prototypes.
 */
export const shadcnComponentPresets = {
  'shadcn-switch': shadcnSwitchComponentPreset,
  'shadcn-dialog': shadcnDialogComponentPreset,
  'shadcn-checkbox': shadcnCheckboxComponentPreset,
} as const satisfies Record<string, ShadcnComponentPresetRecipe>;

export default shadcnComponentPresets;
