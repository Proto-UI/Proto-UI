import { definePrototype, tw } from '@proto.ui/core';
import { asSelectSurface } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectSurfaceProps } from './types';

// Semantic-only structural part: Bootstrap 2.3.2 `.dropdown-menu` chrome and
// bounds stay on Content. Surface carries the item-aligned structure without
// adding a second popup or scroll owner.
export default definePrototype<Bootstrap232SelectSurfaceProps>({
  name: 'bootstrap-2-3-2-select-surface',
  setup(def) {
    asSelectSurface();
    def.feedback.style.use(tw('flex min-h-0 min-w-0 flex-col'));
    return (renderer) => [renderer.r.slot()];
  },
});
