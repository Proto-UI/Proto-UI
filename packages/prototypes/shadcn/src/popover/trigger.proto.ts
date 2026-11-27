import { definePrototype } from '@proto.ui/core';
import { asPopoverTrigger, type PopoverTriggerExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTriggerProps } from './types';
import { setupPopoverCommandPaint } from './command-paint';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'shadcn-popover-trigger',
  modules: asPopoverTrigger.modules,
  setup(def) {
    const behavior = asPopoverTrigger();
    def.props.define({
      presentation: { type: 'enum', empty: 'fallback', options: ['default', 'navigation'] },
    });
    def.props.setDefaults({ presentation: 'default' });
    // This concrete Trigger owns presentation's complete enum and default.
    // The private paint installer reads it directly without a mirrored State.
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
    return behavior.render;
  },
});
