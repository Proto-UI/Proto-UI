import { definePrototype } from '@proto.ui/core';
import { asPopoverClose, type PopoverCloseExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverCloseProps } from './types';
import { setupPopoverCommandPaint } from './command-paint';

export default definePrototype<PopoverCloseProps, PopoverCloseExposes>({
  name: 'shadcn-popover-close',
  modules: asPopoverClose.modules,
  setup(def) {
    const behavior = asPopoverClose();
    const state = behavior.getState!;
    setupPopoverCommandPaint(
      def,
      {
        hovered: state('hovered')!,
        focusVisible: state('focusVisible')!,
        disabled: state('disabled')!,
        pressed: state('pressed')!,
      },
      'close'
    );
    return behavior.render;
  },
});
