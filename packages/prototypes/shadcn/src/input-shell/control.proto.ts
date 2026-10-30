import { definePrototype } from '@proto.ui/core';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import type { InputShellControlProps, InputShellControlExposes } from './types';
import { setupInputShellControlPaint } from './visual';
/** Ordinary Input semantic editor for the same passive shell used by Command. */
export const inputShellControl = definePrototype<InputShellControlProps, InputShellControlExposes>({
  name: 'shadcn-input-shell-control',
  modules: asInputRoot.modules,
  setup(def) {
    const state = asInputRoot().stateHandles;
    if (!state) throw new Error('[input-shell] Input state handles are required');
    setupInputShellControlPaint(def, state.disabled);
    return () => null;
  },
});
export default inputShellControl;
