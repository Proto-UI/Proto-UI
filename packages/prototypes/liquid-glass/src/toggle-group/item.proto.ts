import { definePrototype, tw } from '@proto.ui/core';
import {
  asToggleGroupItem,
  type ToggleGroupItemProps,
  type ToggleGroupItemExposes,
} from '@proto.ui/prototypes-base/toggle-group';

export default definePrototype<ToggleGroupItemProps, ToggleGroupItemExposes>({
  name: 'liquid-glass-toggle-group-item',
  setup(def) {
    const behavior = asToggleGroupItem();
    def.feedback.style.use(
      tw(
        'rounded-xl border border-border inline-flex min-w-0 items-center justify-center px-3 py-2 outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('active')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
  },
});
