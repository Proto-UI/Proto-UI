import { definePrototype, tw } from '@proto.ui/core';
import { asSelectLabel } from '@proto.ui/prototypes-base/select';
import type { Bootstrap232SelectLabelProps, Bootstrap232SelectLabelExposes } from './types';

// `li.nav-header` (navs.less): 11px bold uppercase `#999` with a white
// text-shadow on `3px 15px` padding. The `text-paint` literal carries the
// pinned color plus shadow in one bounded vocabulary token.
export default definePrototype<Bootstrap232SelectLabelProps, Bootstrap232SelectLabelExposes>({
  name: 'bootstrap-2-3-2-select-label',
  setup(def) {
    asSelectLabel();
    def.feedback.style.use(
      tw(
        'block px-[15px] py-[3px] text-[11px] font-bold leading-5 uppercase text-paint-[#999_0_1px_0_rgb(255_255_255/50%)]'
      )
    );
    return (renderer) => [renderer.r.slot()];
  },
});
