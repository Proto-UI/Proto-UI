import { definePrototype, tw } from '@proto.ui/core';
import { asHoverCardRoot } from '@proto.ui/prototypes-base/hover-card';
import type { BrutalistHoverCardRootExposes, BrutalistHoverCardRootProps } from './types';

const hoverCardRoot = definePrototype<BrutalistHoverCardRootProps, BrutalistHoverCardRootExposes>({
  name: 'brutalist-hover-card-root',
  setup(def) {
    // P-BRUTALIST-HOVER-CARD-BASE-INHERITANCE
    asHoverCardRoot();
    // P-BRUTALIST-HOVER-CARD-VISUAL-GRAMMAR
    def.feedback.style.use(tw('relative inline-flex items-start'));
  },
});

/** P-BRUTALIST-HOVER-CARD-ENTRY */
export default hoverCardRoot;
