import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleRoot } from '@proto.ui/prototypes-base/collapsible';
import type { ShadcnCollapsibleRootProps, ShadcnCollapsibleRootExposes } from './types';

// P-SHADCN-COLLAPSIBLE-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleRoot = definePrototype<ShadcnCollapsibleRootProps, ShadcnCollapsibleRootExposes>({
  name: 'shadcn-collapsible-root',
  setup(def) {
    asCollapsibleRoot();
    // P-SHADCN-COLLAPSIBLE-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground w-full grid gap-2'));
  },
});

export default collapsibleRoot;
