import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleContent } from '@proto.ui/prototypes-base/collapsible';
import { setupShadcnStyleSelection } from '../style-scope';
import type { ShadcnCollapsibleContentProps, ShadcnCollapsibleContentExposes } from './types';

// P-SHADCN-COLLAPSIBLE-CONTENT-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleContent = definePrototype<
  ShadcnCollapsibleContentProps,
  ShadcnCollapsibleContentExposes
>({
  name: 'shadcn-collapsible-content',
  modules: asCollapsibleContent.modules,
  setup(def) {
    const inherited = asCollapsibleContent();
    setupShadcnStyleSelection(def, 'new-york-v4');
    // P-SHADCN-COLLAPSIBLE-CONTENT-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground wrap-anywhere rounded-md border border-border bg-background p-3 text-sm'
      )
    );
    return inherited.render;
  },
});

export default collapsibleContent;
