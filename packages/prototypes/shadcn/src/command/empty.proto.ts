import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandEmpty,
  type CommandEmptyProps,
  type CommandEmptyExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandEmptyProps, CommandEmptyExposes>({
  name: 'shadcn-command-empty',
  setup(def) {
    const behavior = asCommandEmpty();
    def.feedback.style.use(tw('px-3 py-6 text-center text-sm text-muted-foreground'));
  },
});
