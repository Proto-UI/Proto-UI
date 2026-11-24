import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverDescription,
  type PopoverDescriptionProps,
  type PopoverDescriptionExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverDescriptionProps, PopoverDescriptionExposes>({
  name: 'liquid-glass-popover-description',
  modules: asPopoverDescription.modules,
  setup(def) {
    const behavior = asPopoverDescription();
    def.feedback.style.use(tw('font-sans text-sm leading-relaxed text-muted-foreground'));
    return behavior.render;
  },
});
