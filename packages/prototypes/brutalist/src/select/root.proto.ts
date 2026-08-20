import { definePrototype } from '@proto.ui/core';
import { asSelectRoot } from '@proto.ui/prototypes-base/select';
import type { BrutalistSelectRootExposes, BrutalistSelectRootProps } from './types';

const selectRoot = definePrototype<BrutalistSelectRootProps, BrutalistSelectRootExposes>({
  name: 'brutalist-select-root',
  setup() {
    // P-BRUTALIST-SELECT-BASE-INHERITANCE: inherit Base Select Root ownership (open/value/disabled states) once.
    // P-BRUTALIST-SELECT-ENTRY: direct entry name `brutalist-select-root`.
    asSelectRoot();
  },
});

// P-BRUTALIST-SELECT-ENTRY: `brutalist-select-root` is the only public Select root entry in this slice.

export default selectRoot;
