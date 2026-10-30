import type {
  CheckboxIndicatorAsHookContract,
  CheckboxIndicatorExposes,
  CheckboxIndicatorProps,
  CheckboxIndicatorStateHandles,
  CheckboxRootAsHookContract,
  CheckboxRootExposes,
  CheckboxRootProps,
  CheckboxRootStateHandles,
} from '@proto.ui/prototypes-base/checkbox';

// Proto design-language extension, not an Apple component. The functional
// owner can request the shared optical material; explicit opaque keeps its
// complete same-state fill and foreground without requesting glass.
export type LiquidGlassCheckboxRootProps = CheckboxRootProps & {
  material?: 'auto' | 'opaque';
};
export type LiquidGlassCheckboxRootExposes = CheckboxRootExposes;
export type LiquidGlassCheckboxRootStateHandles = CheckboxRootStateHandles;
export type LiquidGlassCheckboxRootAsHookContract = CheckboxRootAsHookContract;

export type LiquidGlassCheckboxIndicatorProps = CheckboxIndicatorProps;
export type LiquidGlassCheckboxIndicatorExposes = CheckboxIndicatorExposes;
export type LiquidGlassCheckboxIndicatorStateHandles = CheckboxIndicatorStateHandles;
export type LiquidGlassCheckboxIndicatorAsHookContract = CheckboxIndicatorAsHookContract;
