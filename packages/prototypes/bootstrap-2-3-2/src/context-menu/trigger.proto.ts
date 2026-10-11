import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuTrigger,
  type ContextMenuTriggerProps,
  type ContextMenuTriggerExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuTriggerProps, ContextMenuTriggerExposes>({
  name: 'bootstrap-2-3-2-context-menu-trigger',
  setup(def) {
    const behavior = asContextMenuTrigger();
    def.feedback.style.use(
      tw(
        'rounded border border-border inline-flex min-w-0 items-center justify-center px-3 py-2 text-sm font-medium outline-none min-h-24 border border-dashed w-64 whitespace-normal'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
  },
});
