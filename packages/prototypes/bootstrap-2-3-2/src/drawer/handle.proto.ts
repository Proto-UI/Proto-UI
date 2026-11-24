import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'bootstrap-2-3-2-drawer-handle',
  setup(def) {
    const behavior = asDrawerHandle();
    const focusVisible = behavior.getState!('focusVisible')!;
    useDrawerHandleEdgeStyle(def);
    def.feedback.style.use(tw('border border-border bg-muted shadow-inner'));
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-ring')),
    });
  },
});
