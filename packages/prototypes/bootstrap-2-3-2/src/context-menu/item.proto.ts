import { definePrototype, tw } from '@proto.ui/core';
import {
  asContextMenuItem,
  type ContextMenuItemProps,
  type ContextMenuItemExposes,
} from '@proto.ui/prototypes-base/context-menu';
export default definePrototype<ContextMenuItemProps, ContextMenuItemExposes>({
  name: 'bootstrap-2-3-2-context-menu-item',
  setup(def) {
    const behavior = asContextMenuItem();
    def.feedback.style.use(
      tw('flex min-w-0 items-center rounded-sm px-3 py-2 text-sm outline-none break-words')
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focused')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
  },
});
