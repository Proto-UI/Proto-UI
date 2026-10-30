import { definePrototype } from '@proto.ui/core';
import { asToolbarButton } from '@proto.ui/prototypes-base/toolbar';
import { setupCollectionActionVisual } from './action-visual';
import type { ShadcnToolbarButtonProps, ShadcnToolbarButtonExposes } from './types';

export default definePrototype<ShadcnToolbarButtonProps, ShadcnToolbarButtonExposes>({
  name: 'shadcn-toolbar-button',
  modules: asToolbarButton.modules,
  setup(def) {
    const behavior = asToolbarButton();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-toolbar] Button state unavailable.');
    setupCollectionActionVisual(def, state, 'ghost');
    return behavior.render;
  },
});
