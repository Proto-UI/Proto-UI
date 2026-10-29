import { definePrototype, tw } from '@proto.ui/core';
import { asSelectViewport } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectViewportProps } from './types';

// The `.dropdown-menu` option list scrolls inside the menu box; Viewport is
// the bounded scroll region in the item-aligned structure.
export default definePrototype<Bootstrap232SelectViewportProps>({
  name: 'bootstrap-2-3-2-select-viewport',
  setup(def) {
    const inherited = asSelectViewport();
    def.feedback.style.use(tw('relative min-h-0 min-w-0 overflow-x-hidden overflow-y-auto'));
    return inherited.render;
  },
});
