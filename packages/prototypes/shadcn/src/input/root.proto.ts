import { definePrototype } from '@proto.ui/core';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import type { ShadcnInputRootExposes, ShadcnInputRootProps } from './types';
import { setupInputVisual } from './visual';

export const ShadcnInputRoot = definePrototype<ShadcnInputRootProps, ShadcnInputRootExposes>({
  name: 'shadcn-input-root',
  modules: asInputRoot.modules,
  setup(def) {
    // P-SHADCN-INPUT-BASE-INHERITANCE: Base owns the editing protocol and editor.
    const inherited = asInputRoot();
    const state = inherited.stateHandles;
    if (!state) {
      throw new Error('[shadcn-input-root] asInputRoot must project Input state handles.');
    }

    setupInputVisual(def, state);

    // P-SHADCN-INPUT-CONTENTLESS: the caller owns its renderer; children are not another editor.
    return inherited.render;
  },
});

export default ShadcnInputRoot;
