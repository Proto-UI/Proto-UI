import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardRoot,
  type HoverCardRootProps,
  type HoverCardRootExposes,
} from '@proto.ui/prototypes-base/hover-card';

export default definePrototype<HoverCardRootProps, HoverCardRootExposes>({
  name: 'liquid-glass-hover-card-root',
  setup(def) {
    const behavior = asHoverCardRoot();
    def.feedback.style.use(tw('relative inline-flex items-start min-w-0'));
  },
});
