import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'liquid-glass-drawer-handle',
  setup(def) {
    const behavior = asDrawerHandle();
    const focusVisible = behavior.getState!('focusVisible')!;
    useDrawerHandleEdgeStyle(def);
    def.feedback.style.use(tw('bg-foreground/30'));
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-ring')),
    });
  },
});
