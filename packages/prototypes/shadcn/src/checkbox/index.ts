import checkboxIndicator from './indicator.proto';
import checkboxRoot from './root.proto';

export type {
  ShadcnCheckboxRootProps,
  ShadcnCheckboxRootExposes,
  ShadcnCheckboxRootStateHandles,
  ShadcnCheckboxRootAsHookContract,
  ShadcnCheckboxIndicatorProps,
  ShadcnCheckboxIndicatorExposes,
  ShadcnCheckboxIndicatorStateHandles,
  ShadcnCheckboxIndicatorAsHookContract,
} from './types';

export { checkboxRoot, checkboxIndicator };
export { default as shadcnCheckboxRoot } from './root.proto';
export { default as shadcnCheckboxIndicator } from './indicator.proto';
export { default as componentPreset, shadcnCheckboxComponentPreset } from './preset';
