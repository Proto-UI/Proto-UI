import { definePrototype, tw } from '@proto.ui/core';
import {
  asTextareaRoot,
  type TextareaRootProps,
  type TextareaRootExposes,
} from '@proto.ui/prototypes-base/textarea';
import { setupInputVisual } from '../input/visual';

// Independently expressed Bootstrap 2.3.2 design-language projection.
// Base retains all semantics; source attribution: ../../THIRD_PARTY_NOTICES.md.
// Upstream textarea: same forms.less text-control paint with AUTO height.
export default definePrototype<TextareaRootProps, TextareaRootExposes>({
  name: 'bootstrap-2-3-2-textarea-root',
  modules: asTextareaRoot.modules,
  setup(def) {
    const inherited = asTextareaRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-textarea-root] Base state handles required.');
    setupInputVisual(def, state, undefined, 'multiline');
    // Deliberate draft differences (criterion P-BOOTSTRAP-2-3-2-TEXTAREA-VISUAL):
    // 64px minimum height and vertical resize; upstream reset.less/forms.less
    // set neither (upstream height is auto with no resize property).
    def.feedback.style.use(tw('min-h-16 resize-y'));
    return inherited.render;
  },
});
