import { definePrototype } from '@proto.ui/core';
import { asSelectSurface } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectSurfaceProps } from './types';

// Semantic-only structural part: Bootstrap 2.3.2 `.dropdown-menu` chrome and
// scroll bounds stay on Content; Surface exists for the item-aligned structure
// and renders nothing extra.
export default definePrototype<Bootstrap232SelectSurfaceProps>({
  name: 'bootstrap-2-3-2-select-surface',
  setup() {
    asSelectSurface();
    return (renderer) => [renderer.r.slot()];
  },
});
