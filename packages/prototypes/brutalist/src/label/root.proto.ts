import { definePrototype, tw } from '@proto.ui/core';
import {
  asLabelRoot,
  type LabelRootProps,
  type LabelRootExposes,
} from '@proto.ui/prototypes-base/label';

export default definePrototype<LabelRootProps, LabelRootExposes>({
  name: 'brutalist-label-root',
  modules: asLabelRoot.modules,
  setup(def) {
    const inherited = asLabelRoot();
    // Passive label typography per Brutalist design contract (DM Sans 500, no shadow/motion).
    def.feedback.style.use(
      tw(
        'flex w-fit max-w-full items-center gap-2 font-sans text-sm font-medium leading-none text-start break-words text-foreground'
      )
    );
    return inherited.render;
  },
});
