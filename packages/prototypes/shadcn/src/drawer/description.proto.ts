import { definePrototype } from '@proto.ui/core';
import {
  asDrawerDescription,
  type DrawerDescriptionExposes,
} from '@proto.ui/prototypes-base/drawer';
import type { DrawerDescriptionProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { DRAWER_DESCRIPTION } from './recipes';

export default definePrototype<DrawerDescriptionProps, DrawerDescriptionExposes>({
  name: 'shadcn-drawer-description',
  setup(def) {
    const behavior = asDrawerDescription();
    setupOverlayPaint(def, DRAWER_DESCRIPTION);
  },
});
