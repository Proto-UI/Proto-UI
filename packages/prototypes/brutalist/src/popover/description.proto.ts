import { definePrototype, tw } from '@proto.ui/core';
import {
  asPopoverDescription,
  type PopoverDescriptionProps,
  type PopoverDescriptionExposes,
} from '@proto.ui/prototypes-base/popover';

export default definePrototype<PopoverDescriptionProps, PopoverDescriptionExposes>({
  name: 'brutalist-popover-description',
  modules: asPopoverDescription.modules,
  setup(def) {
    const behavior = asPopoverDescription();
    def.feedback.style.use(tw('font-sans font-medium text-sm text-foreground'));
    return behavior.render;
  },
});
