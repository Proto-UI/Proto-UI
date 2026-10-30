import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'brutalist-command-content',
  setup(def) {
    const behavior = asCommandContent();
    def.feedback.style.use(
      tw('min-h-0 min-w-0 w-full max-h-[18.75rem] scroll-py-1 overflow-x-hidden overflow-y-auto')
    );
  },
});
