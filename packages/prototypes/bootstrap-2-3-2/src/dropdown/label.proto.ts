import { definePrototype, tw } from '@proto.ui/core';
import {
  asDropdownLabel,
  type DropdownLabelProps as BaseDropdownLabelProps,
} from '@proto.ui/prototypes-base/dropdown';

export interface BootstrapDropdownLabelProps extends BaseDropdownLabelProps {
  inset?: boolean;
}

export default definePrototype<BootstrapDropdownLabelProps>({
  name: 'bootstrap-2-3-2-dropdown-label',
  modules: asDropdownLabel.modules,
  setup(def) {
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ inset: false });
    const behavior = asDropdownLabel();
    def.feedback.style.use(
      tw(
        'block px-[20px] py-[3px] text-[11px] font-bold leading-[20px] text-paint-[#999_0_1px_0_rgb(255_255_255/50%)] uppercase'
      )
    );
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-9')),
    });
    return behavior.render;
  },
});
