import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleProps,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'shadcn-drawer-handle',
  setup(def) {
    const behavior = asDrawerHandle();
    const side = behavior.getState!('side')!;
    // Retain the non-bottom resize affordances until the separate full-Content
    // drag/Indicator definition is implemented; never hide a live keyboard control.
    useDrawerHandleEdgeStyle(def, { bottom: false });
    def.feedback.style.use(tw('bg-muted'));
    def.rule({
      when: (w) => w.state(side).eq('bottom'),
      intent: (i) =>
        i.feedback.style.use(tw('relative mx-[auto] mt-4 h-2 w-[100px] shrink-0 cursor-ns-resize')),
    });
  },
});
