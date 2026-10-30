import { definePrototype, tw } from '@proto.ui/core';
import { asRadioGroupRoot } from '@proto.ui/prototypes-base/radio-group';
import type { LiquidGlassRadioGroupRootExposes, LiquidGlassRadioGroupRootProps } from './types';

// Structural semantic owner: the Base collection, roving focus, selection and
// request path stay untouched. The Root paints only group layout — no material
// owner is added for a passive stacking container.
export default definePrototype<LiquidGlassRadioGroupRootProps, LiquidGlassRadioGroupRootExposes>({
  name: 'liquid-glass-radio-group-root',
  setup(def) {
    const inherited = asRadioGroupRoot();
    def.feedback.style.use(tw('flex w-full min-w-0 flex-col gap-3 text-foreground'));
    return inherited.render;
  },
});
