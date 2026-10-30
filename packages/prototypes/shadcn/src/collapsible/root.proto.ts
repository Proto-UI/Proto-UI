import { definePrototype, tw } from '@proto.ui/core';
import { asCollapsibleRoot } from '@proto.ui/prototypes-base/collapsible';
import { setupShadcnStyleScope } from '../style-scope';
import type { ShadcnCollapsibleRootProps, ShadcnCollapsibleRootExposes } from './types';

// P-SHADCN-COLLAPSIBLE-BASE-INHERITANCE: Base is the only semantic owner.
// The pinned reference primitives are unstyled; these safe host defaults are a Proto UI delta.
const collapsibleRoot = definePrototype<ShadcnCollapsibleRootProps, ShadcnCollapsibleRootExposes>({
  name: 'shadcn-collapsible-root',
  modules: asCollapsibleRoot.modules,
  setup(def) {
    const inherited = asCollapsibleRoot();
    setupShadcnStyleScope(def);
    // Both the adopted f31ed819 New York primitives and all eight modern
    // 3d98900e primitives are unstyled. This existing frame remains a declared
    // Proto delta for every selection, not an invented upstream profile.
    // P-SHADCN-COLLAPSIBLE-VISUAL-SAFETY: no fixed width/height or clipped long label.
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground w-full grid gap-2'));
    return inherited.render;
  },
});

export default collapsibleRoot;
