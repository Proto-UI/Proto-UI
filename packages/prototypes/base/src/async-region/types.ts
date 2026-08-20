import type { ExposeState, State } from '@proto.ui/core';

export interface AsyncRegionRootProps {
  busy?: boolean;
}

// P-BASE-ASYNC-REGION-BUSY: only the governed busy state is exposed.
export type AsyncRegionRootExposes = {
  busy: ExposeState<boolean>;
};

export type AsyncRegionRootStateHandles = {
  busy: State<boolean>;
};

export type AsyncRegionRootAsHookContract = { state: AsyncRegionRootStateHandles };
