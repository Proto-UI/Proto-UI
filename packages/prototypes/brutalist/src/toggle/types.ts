import type {
  ToggleAsHookContract,
  ToggleExposes,
  ToggleProps,
  ToggleStateHandles,
} from '@proto.ui/prototypes-base/toggle';

export type BrutalistToggleSize = 'default' | 'sm' | 'lg';
export type BrutalistToggleVariant = 'default' | 'outline';

export interface BrutalistToggleProps extends ToggleProps {
  variant?: BrutalistToggleVariant;
  size?: BrutalistToggleSize;
}

export type BrutalistToggleExposes = ToggleExposes;
export type BrutalistToggleStateHandles = ToggleStateHandles;
export type BrutalistToggleAsHookContract = ToggleAsHookContract;
