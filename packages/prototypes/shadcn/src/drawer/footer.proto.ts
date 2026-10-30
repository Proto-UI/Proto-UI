import { definePrototype, tw } from '@proto.ui/core';
import { asDrawerFooter, type DrawerFooterExposes } from '@proto.ui/prototypes-base/drawer';
import type { DrawerFooterProps } from './types';
import { setupOverlayStyle } from '../dialog/style';

export default definePrototype<DrawerFooterProps, DrawerFooterExposes>({
  name: 'shadcn-drawer-footer',
  setup(def) {
    asDrawerFooter();
    setupOverlayStyle(def);
    // New York mt-auto; existing portable arbitrary spacing expresses the same auto margin.
    def.feedback.style.use(tw('mt-[auto] flex flex-col gap-2 p-4'));
    return (renderer) => renderer.r.slot();
  },
});
