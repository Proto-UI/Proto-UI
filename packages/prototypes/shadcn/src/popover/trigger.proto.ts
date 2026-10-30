import { definePrototype } from '@proto.ui/core';
import { asPopoverTrigger, type PopoverTriggerExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTriggerProps } from './types';
import { setupPopoverCommandPaint } from './command-paint';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'shadcn-popover-trigger',
  setup(def) {
    const behavior = asPopoverTrigger();
    const state = behavior.getState!;
    setupPopoverCommandPaint(
      def,
      {
        hovered: state('hovered')!,
        focusVisible: state('focusVisible')!,
        disabled: state('disabled')!,
        pressed: state('pressed')!,
      },
      'trigger'
    );
  },
});
