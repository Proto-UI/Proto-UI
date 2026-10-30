import { definePrototype } from '@proto.ui/core';
import { asTextareaRoot } from '@proto.ui/prototypes-base/textarea';
import { setupTextareaVisual } from './visual';
import type { ShadcnTextareaRootExposes, ShadcnTextareaRootProps } from './types';

export const ShadcnTextareaRoot = definePrototype<
  ShadcnTextareaRootProps,
  ShadcnTextareaRootExposes
>({
  name: 'shadcn-textarea-root',
  modules: asTextareaRoot.modules,
  setup(def) {
    const inherited = asTextareaRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[shadcn-textarea-root] Missing Base Textarea state handles.');
    setupTextareaVisual(def, state);
    return inherited.render;
  },
});
