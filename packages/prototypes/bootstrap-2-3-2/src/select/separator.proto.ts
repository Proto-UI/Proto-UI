import { definePrototype, tw } from '@proto.ui/core';
import { asSelectSeparator } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectSeparatorProps, Bootstrap232SelectSeparatorExposes } from './types';

// `.dropdown-menu .divider` = `.nav-divider` (navs.less): a 1px `#e5e5e5`
// top line over a 1px white bottom line at `margin: 9px 1px`. The caller
// renders no content; the part keeps Base's aria-hidden tree marker.
export default definePrototype<
  Bootstrap232SelectSeparatorProps,
  Bootstrap232SelectSeparatorExposes
>({
  name: 'bootstrap-2-3-2-select-separator',
  setup(def) {
    asSelectSeparator();
    def.feedback.style.use(
      tw(
        'block pointer-events-none my-[9px] mx-px h-0 border-0 border-t border-b border-[#e5e5e5_#e5e5e5_#fff_#e5e5e5]'
      )
    );
    return () => null;
  },
});
