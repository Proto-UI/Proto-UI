import { definePrototype, tw } from '@proto.ui/core';
import {
  asToolbarSeparator,
  type ToolbarSeparatorProps,
  type ToolbarSeparatorExposes,
} from '@proto.ui/prototypes-base/toolbar';

export default definePrototype<ToolbarSeparatorProps, ToolbarSeparatorExposes>({
  name: 'bootstrap-2-3-2-toolbar-separator',
  modules: asToolbarSeparator.modules,
  setup(def) {
    const behavior = asToolbarSeparator();
    def.feedback.style.use(tw('shrink-0 self-stretch bg-[#e5e5e5]'));
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('vertical'),
      intent: (i) => i.feedback.style.use(tw('w-[1px] mx-[5px]')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('orientation')!).eq('horizontal'),
      intent: (i) => i.feedback.style.use(tw('h-[1px] my-[5px]')),
    });
    return behavior.render;
  },
});
