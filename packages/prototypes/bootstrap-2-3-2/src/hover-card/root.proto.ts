import { definePrototype, tw } from '@proto.ui/core';
import {
  asHoverCardRoot,
  type HoverCardRootProps,
  type HoverCardRootExposes,
} from '@proto.ui/prototypes-base/hover-card';

export default definePrototype<HoverCardRootProps, HoverCardRootExposes>({
  name: 'bootstrap-2-3-2-hover-card-root',
  setup(def) {
    asHoverCardRoot();
    def.feedback.style.use(tw('relative inline-flex min-w-0'));
  },
});
