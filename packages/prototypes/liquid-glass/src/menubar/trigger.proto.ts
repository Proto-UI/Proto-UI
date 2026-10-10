import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarTrigger,
  type MenubarTriggerProps,
  type MenubarTriggerExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarTriggerProps, MenubarTriggerExposes>({
  name: 'liquid-glass-menubar-trigger',
  setup(def) {
    const behavior = asMenubarTrigger();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border inline-flex min-w-0 items-center justify-center px-3 py-2 text-sm font-medium outline-none'
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
