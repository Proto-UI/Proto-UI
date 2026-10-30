import { definePrototype } from '@proto.ui/core';
import {
  asPopoverDescription,
  type PopoverDescriptionExposes,
} from '@proto.ui/prototypes-base/popover';
import type { PopoverDescriptionProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { POPOVER_DESCRIPTION } from './recipes';

export default definePrototype<PopoverDescriptionProps, PopoverDescriptionExposes>({
  name: 'shadcn-popover-description',
  setup(def) {
    const behavior = asPopoverDescription();
    setupOverlayPaint(def, POPOVER_DESCRIPTION, 'nova');
  },
});
