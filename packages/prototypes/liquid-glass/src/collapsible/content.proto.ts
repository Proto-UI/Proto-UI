import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleContent } from '@proto.ui/prototypes-base/collapsible';
import type {
  LiquidGlassCollapsibleContentProps,
  LiquidGlassCollapsibleContentExposes,
} from './types';

// P-LIQUID-GLASS-COLLAPSIBLE-CONTENT-BASE-INHERITANCE: Base is the only semantic owner.
// Reading content stays opaque so glass is never stacked on glass.
const collapsibleContent = definePrototype<
  LiquidGlassCollapsibleContentProps,
  LiquidGlassCollapsibleContentExposes
>({
  name: 'liquid-glass-collapsible-content',
  modules: asCollapsibleContent.modules,
  setup(def) {
    const inherited = asCollapsibleContent();
    // P-LIQUID-GLASS-COLLAPSIBLE-CONTENT-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere rounded-xl border border-border bg-secondary p-4 text-sm shadow-sm animate-in fade-in-0 duration-150'
      )
    );
    return inherited.render;
  },
});

export default collapsibleContent;
