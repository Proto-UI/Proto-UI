import type { ExposeState, State } from '@proto.ui/core';

export type SeparatorOrientation = 'horizontal' | 'vertical';

export interface SeparatorRootProps {
  orientation?: SeparatorOrientation;
  decorative?: boolean;
}

export type SeparatorRootExposes = {
  orientation: ExposeState<SeparatorOrientation>;
  decorative: ExposeState<boolean>;
};

export type SeparatorRootStateHandles = {
  orientation: State<SeparatorOrientation>;
  decorative: State<boolean>;
};

export type SeparatorRootAsHookContract = { state: SeparatorRootStateHandles };
