import { definePrototype } from '@proto.ui/core';
import { asDrawerTitle, type DrawerTitleExposes } from '@proto.ui/prototypes-base/drawer';
import type { DrawerTitleProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { DRAWER_TITLE } from './recipes';

export default definePrototype<DrawerTitleProps, DrawerTitleExposes>({
  name: 'shadcn-drawer-title',
  setup(def) {
    asDrawerTitle();
    setupOverlayPaint(def, DRAWER_TITLE);
  },
});
