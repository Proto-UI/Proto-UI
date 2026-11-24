import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarSeparator,
  type ToolbarSeparatorProps,
  type ToolbarSeparatorExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarSeparatorProps, ToolbarSeparatorExposes>({
  name: 'liquid-glass-toolbar-separator',
  modules: asToolbarSeparator.modules,
  setup(def) {
    const behavior = asToolbarSeparator();
    def.feedback.style.use(tw('shrink-0 bg-border'));
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('w-px self-stretch mx-1 my-1')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-px w-full my-1 mx-0')),
    });
    return behavior.render;
  },
});
