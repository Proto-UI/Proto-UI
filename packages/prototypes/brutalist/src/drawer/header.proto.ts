import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHeader,
  asDrawerAcceptedSide,
  type DrawerHeaderProps,
  type DrawerHeaderExposes,
} from '@proto.ui/prototypes-base/drawer';

export default definePrototype<DrawerHeaderProps, DrawerHeaderExposes>({
  name: 'brutalist-drawer-header',
  setup(def) {
    asDrawerHeader();
    const acceptedSide = asDrawerAcceptedSide();
    const side = def.state.string('headerSide', '');
    acceptedSide.observe((value) => side.set(value ?? '', 'reason: drawer header side projection'));
    def.lifecycle.onCreated(() => side.set(acceptedSide.read() ?? ''));
    def.feedback.style.use(tw('flex flex-col gap-1.5 font-sans'));
    def.rule({
      when: (w) => w.any(w.state(side).eq('top'), w.state(side).eq('bottom')),
      intent: (i) => i.feedback.style.use(tw('text-center')),
    });
    def.rule({
      when: (w) => w.any(w.state(side).eq('left'), w.state(side).eq('right')),
      intent: (i) => i.feedback.style.use(tw('text-start')),
    });
    return (renderer) => renderer.r.slot();
  },
});
