import { definePrototype, tw } from '@proto.ui/core';
import { asDropdownLabel, type DropdownLabelProps } from '@proto.ui/prototypes-base/dropdown';
export default definePrototype<DropdownLabelProps>({
  name: 'bootstrap-2-3-2-dropdown-label',
  modules: asDropdownLabel.modules,
  setup(def) {
    const behavior = asDropdownLabel();
    def.feedback.style.use(
      tw(
        'block px-[20px] py-[3px] text-[11px] font-bold leading-[20px] text-paint-[#999_0_1px_0_rgb(255_255_255/50%)] uppercase'
      )
    );
    return behavior.render;
  },
});
