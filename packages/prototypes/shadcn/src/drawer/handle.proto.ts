import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHandle,
  useDrawerHandleEdgeStyle,
  type DrawerHandleExposes,
} from '@proto.ui/prototypes-base/drawer';
import type { DrawerHandleProps } from './types';
import { SHADCN_STYLE_IDS } from '../style-scope';
import { setupOverlayStyle } from '../dialog/style';
import { DRAWER_BOTTOM_HANDLE } from './recipes';
export default definePrototype<DrawerHandleProps, DrawerHandleExposes>({
  name: 'shadcn-drawer-handle',
  setup(def) {
    const behavior = asDrawerHandle();
    const side = behavior.getState!('side')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const style = setupOverlayStyle(def);
    // Retain the non-bottom resize affordances until the separate full-Content
    // drag/Indicator definition is implemented; never hide a live keyboard control.
    useDrawerHandleEdgeStyle(def, { bottom: false });
    def.feedback.style.use(tw('bg-muted'));
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-ring')),
    });
    def.rule({
      when: (w) => w.state(side).eq('bottom'),
      intent: (i) =>
        i.feedback.style.use(tw('relative mx-[auto] mt-4 w-[100px] shrink-0 cursor-ns-resize')),
    });
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(side).eq('bottom')),
        intent: (i) => i.feedback.style.use(DRAWER_BOTTOM_HANDLE[profile]),
      });
    }
    for (const profile of ['lyra', 'sera'] as const) {
      def.rule({
        when: (w) =>
          w.all(
            w.state(style).eq(profile),
            w.any(w.state(side).eq('top'), w.state(side).eq('left'), w.state(side).eq('right'))
          ),
        intent: (i) => i.feedback.style.use(tw('rounded-none')),
      });
    }
  },
});
