import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleRoot } from '@proto.ui/prototypes-base/collapsible';
import type { LiquidGlassCollapsibleRootProps, LiquidGlassCollapsibleRootExposes } from './types';

// P-LIQUID-GLASS-COLLAPSIBLE-BASE-INHERITANCE: Base is the only semantic owner.
// Opaque presentation only. Shared explicit optical-material integration remains pending.
// Do not substitute adaptive/native backdrop blur for an explicit glass request.
const collapsibleRoot = definePrototype<
  LiquidGlassCollapsibleRootProps,
  LiquidGlassCollapsibleRootExposes
>({
  name: 'liquid-glass-collapsible-root',
  setup(def) {
    asCollapsibleRoot();
    // P-LIQUID-GLASS-COLLAPSIBLE-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground w-full grid gap-3'));
  },
});

export default collapsibleRoot;
