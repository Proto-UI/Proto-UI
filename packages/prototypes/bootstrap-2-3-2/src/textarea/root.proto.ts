import { definePrototype } from '@proto.ui/core';
import {
  asTextareaRoot,
  type TextareaRootProps,
  type TextareaRootExposes,
} from '@proto.ui/prototypes-base/textarea';
import { setupTextareaVisual } from './visual';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<TextareaRootProps, TextareaRootExposes>({
  name: 'bootstrap-2-3-2-textarea-root',
  modules: asTextareaRoot.modules,
  setup(def) {
    const state = asTextareaRoot().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-textarea-root] Base state handles required.');
    setupTextareaVisual(def, state);
    return () => null;
  },
});
