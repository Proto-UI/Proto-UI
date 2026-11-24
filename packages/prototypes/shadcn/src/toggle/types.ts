import type {
  ToggleAsHookContract,
  ToggleExposes,
  ToggleProps,
  ToggleStateHandles,
} from '@proto.ui/prototypes-base/toggle';
import type { ShadcnStyleProps } from '../style-scope';

export type ShadcnToggleVariant = 'default' | 'outline';
export type ShadcnToggleSize = 'default' | 'sm' | 'lg';

export interface ShadcnToggleProps extends ToggleProps, ShadcnStyleProps {
  variant?: ShadcnToggleVariant;
  size?: ShadcnToggleSize;
}

export type ShadcnToggleExposes = ToggleExposes;

export type ShadcnToggleStateHandles = ToggleStateHandles;

export type ShadcnToggleAsHookContract = ToggleAsHookContract;
