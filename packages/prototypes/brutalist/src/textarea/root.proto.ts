import { definePrototype } from '@proto.ui/core';
import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';
import { setupTextareaVisual } from './visual';
import type { BrutalistTextareaRootExposes, BrutalistTextareaRootProps } from './types';

export const BrutalistTextareaRoot = definePrototype<
  BrutalistTextareaRootProps,
  BrutalistTextareaRootExposes
>({
  name: 'brutalist-textarea-root',
  modules: asTextareaRoot.modules,
  setup(def) {
    const textarea = asTextareaRoot();
    const state = textarea.stateHandles;
    if (!state) {
      throw new Error('[brutalist-textarea] asTextareaRoot must project state handles.');
    }

    setupTextareaVisual(def, state);
    return textarea.render;
  },
});
