import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuTrigger,
  type ContextMenuTriggerProps,
  type ContextMenuTriggerExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuTriggerProps, ContextMenuTriggerExposes>({
  name: 'bootstrap-2-3-2-context-menu-trigger',
  modules: asContextMenuTrigger.modules,
  setup(def) {
    const behavior = asContextMenuTrigger();
    def.feedback.style.use(
      tw('block min-w-0 text-[14px] font-normal leading-[20px] text-foreground')
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    return behavior.render;
  },
});
