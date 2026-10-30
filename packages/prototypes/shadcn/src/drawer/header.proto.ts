import { definePrototype, tw } from '@proto.ui/core';
import {
  asDrawerHeader,
  asDrawerAcceptedSide,
  type DrawerHeaderExposes,
} from '@proto.ui/prototypes-base/drawer';
import type { DrawerHeaderProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { DRAWER_HEADER } from './recipes';

export default definePrototype<DrawerHeaderProps, DrawerHeaderExposes>({
  name: 'shadcn-drawer-header',
  setup(def) {
    asDrawerHeader();
    const acceptedSide = asDrawerAcceptedSide();
    const side = def.state.string('headerSide', '');
    acceptedSide.observe((value) => side.set(value ?? '', 'reason: drawer header side projection'));
    def.lifecycle.onCreated(() => side.set(acceptedSide.read() ?? ''));
    def.feedback.style.use(tw('flex flex-col'));
    setupOverlayPaint(def, DRAWER_HEADER);
    def.rule({
      when: (w) => w.any(w.state(side).eq('top'), w.state(side).eq('bottom')),
      intent: (i) => i.feedback.style.use(tw('text-center')),
    });
    return (renderer) => renderer.r.slot();
  },
});
