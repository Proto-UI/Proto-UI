import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarSeparator,
  type ToolbarSeparatorProps,
  type ToolbarSeparatorExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarSeparatorProps, ToolbarSeparatorExposes>({
  name: 'liquid-glass-toolbar-separator',
  setup(def) {
    const behavior = asToolbarSeparator();
    def.feedback.style.use(tw('shrink-0 w-px self-stretch bg-border mx-1'));
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-px w-auto my-1 mx-0')),
    });
  },
});
