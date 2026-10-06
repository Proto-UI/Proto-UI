import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleContent } from '@proto.ui/prototypes-base/collapsible';
import type {
  LiquidGlassCollapsibleContentProps,
  LiquidGlassCollapsibleContentExposes,
} from './types';

// P-LIQUID-GLASS-COLLAPSIBLE-CONTENT-BASE-INHERITANCE: Base is the only semantic owner.
// Opaque presentation only. Shared explicit optical-material integration remains pending.
// Do not substitute adaptive/native backdrop blur for an explicit glass request.
const collapsibleContent = definePrototype<
  LiquidGlassCollapsibleContentProps,
  LiquidGlassCollapsibleContentExposes
>({
  name: 'liquid-glass-collapsible-content',
  setup(def) {
    asCollapsibleContent();
    // P-LIQUID-GLASS-COLLAPSIBLE-CONTENT-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere rounded-xl border border-border bg-secondary p-4 text-sm shadow-sm'
      )
    );
  },
});

export default collapsibleContent;
