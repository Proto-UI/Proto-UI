import { definePrototype, tw } from '@proto.ui/core';
import { asHoverCardRoot } from '@proto.ui/prototypes-base/hover-card';
import type { ShadcnHoverCardRootExposes, ShadcnHoverCardRootProps } from './types';
import { setupShadcnStyleScope } from '../style-scope';

const hoverCardRoot = definePrototype<ShadcnHoverCardRootProps, ShadcnHoverCardRootExposes>({
  name: 'shadcn-hover-card-root',
  setup(def) {
    // P-SHADCN-HOVER-CARD-BASE-INHERITANCE,
    // P-SHADCN-HOVER-CARD-CURRENT-BASE-DEVIATIONS
    asHoverCardRoot();
    setupShadcnStyleScope(def);
    // P-SHADCN-HOVER-CARD-CURRENT-VISUAL-SURFACE
    def.feedback.style.use(tw('relative inline-flex items-start'));
  },
});

/** P-SHADCN-HOVER-CARD-DIRECT-ENTRY; parity is bounded by P-SHADCN-HOVER-CARD-COMPATIBILITY-SUBSET. */

export default hoverCardRoot;
