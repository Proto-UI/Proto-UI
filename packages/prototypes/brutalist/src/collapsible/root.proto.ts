import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleRoot } from '@proto.ui/prototypes-base/collapsible';
import type { BrutalistCollapsibleRootProps, BrutalistCollapsibleRootExposes } from './types';

// P-BRUTALIST-COLLAPSIBLE-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleRoot = definePrototype<
  BrutalistCollapsibleRootProps,
  BrutalistCollapsibleRootExposes
>({
  name: 'brutalist-collapsible-root',
  modules: asCollapsibleRoot.modules,
  setup(def) {
    const inherited = asCollapsibleRoot();
    // P-BRUTALIST-COLLAPSIBLE-VISUAL-SAFETY: reserve the same rem-space
    // as the Trigger translation, so press displacement never expands Root scroll bounds.
    def.feedback.style.use(
      tw('min-w-0 max-w-full font-sans font-medium text-foreground w-full grid gap-3 pr-1 pb-1')
    );
    return inherited.render;
  },
});

export default collapsibleRoot;
