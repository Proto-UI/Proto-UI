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
import type { ShadcnStyleProps } from '../style-scope';

export interface ShadcnCheckboxRootProps extends CheckboxRootProps, ShadcnStyleProps {}

export type ShadcnCheckboxRootExposes = CheckboxRootExposes;

export type ShadcnCheckboxRootStateHandles = CheckboxRootStateHandles;

export type ShadcnCheckboxRootAsHookContract = CheckboxRootAsHookContract;

export interface ShadcnCheckboxIndicatorProps extends CheckboxIndicatorProps {}

export type ShadcnCheckboxIndicatorExposes = CheckboxIndicatorExposes;

export type ShadcnCheckboxIndicatorStateHandles = CheckboxIndicatorStateHandles;

export type ShadcnCheckboxIndicatorAsHookContract = CheckboxIndicatorAsHookContract;
