import { definePrototype } from '@proto.ui/core';
import { asPopoverTitle, type PopoverTitleExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTitleProps } from './types';
import { setupOverlayPaint } from '../dialog/style';
import { POPOVER_TITLE } from './recipes';

export default definePrototype<PopoverTitleProps, PopoverTitleExposes>({
  name: 'shadcn-popover-title',
  setup(def) {
    const behavior = asPopoverTitle();
    setupOverlayPaint(def, POPOVER_TITLE, 'nova');
  },
});
