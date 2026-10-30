import { definePrototype, tw } from '@proto.ui/core';
import { asSelectLabel } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectLabelProps, Bootstrap232SelectLabelExposes } from './types';

// Dropdown's nav-header override (dropdowns.less): 11px bold uppercase `#999`
// with a white text-shadow and 3px/20px padding.
export default definePrototype<Bootstrap232SelectLabelProps, Bootstrap232SelectLabelExposes>({
  name: 'bootstrap-2-3-2-select-label',
  setup(def) {
    const inherited = asSelectLabel();
    def.feedback.style.use(
      tw(
        'block px-[20px] py-[3px] text-[11px] font-bold leading-[20px] uppercase text-paint-[#999_0_1px_0_rgb(255_255_255/50%)]'
      )
    );
    return inherited.render;
  },
});
