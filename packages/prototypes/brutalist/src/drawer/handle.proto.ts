import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'brutalist-drawer-handle',
  setup(def) {
    const behavior = asDrawerHandle();
    const side = behavior.getState!('side')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    useDrawerHandleEdgeStyle(def, { bottom: false });
    def.feedback.style.use(tw('border-2 border-foreground bg-foreground'));
    def.rule({
      when: (w) => w.state(side).eq('bottom'),
      intent: (i) =>
        i.feedback.style.use(
          tw('relative mx-[auto] mt-1 h-2 w-[100px] shrink-0 rounded-full cursor-ns-resize')
        ),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-ring')),
    });
  },
});
