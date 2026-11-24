import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleContent } from '@proto.ui/prototypes-base/collapsible';
import type { BrutalistCollapsibleContentProps, BrutalistCollapsibleContentExposes } from './types';

// P-BRUTALIST-COLLAPSIBLE-CONTENT-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleContent = definePrototype<
  BrutalistCollapsibleContentProps,
  BrutalistCollapsibleContentExposes
>({
  name: 'brutalist-collapsible-content',
  modules: asCollapsibleContent.modules,
  setup(def) {
    const inherited = asCollapsibleContent();
    // P-BRUTALIST-COLLAPSIBLE-CONTENT-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full font-sans font-medium text-foreground wrap-anywhere rounded-base border-2 border-border dark:border-foreground bg-secondary-background p-4 text-sm'
      )
    );
    return inherited.render;
  },
});

export default collapsibleContent;
