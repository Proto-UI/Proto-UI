import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleRoot } from '@proto.ui/prototypes-base/collapsible';
import type { LiquidGlassCollapsibleRootProps, LiquidGlassCollapsibleRootExposes } from './types';

// P-LIQUID-GLASS-COLLAPSIBLE-BASE-INHERITANCE: Base is the only semantic owner.
// Opaque container only so glass is never stacked on glass.
const collapsibleRoot = definePrototype<
  LiquidGlassCollapsibleRootProps,
  LiquidGlassCollapsibleRootExposes
>({
  name: 'liquid-glass-collapsible-root',
  modules: asCollapsibleRoot.modules,
  setup(def) {
    const inherited = asCollapsibleRoot();
    // P-LIQUID-GLASS-COLLAPSIBLE-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground w-full grid gap-3'));
    return inherited.render;
  },
});

export default collapsibleRoot;
