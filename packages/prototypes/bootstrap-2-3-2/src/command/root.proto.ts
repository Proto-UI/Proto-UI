import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandRoot,
  type CommandRootProps,
  type CommandRootExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandRootProps, CommandRootExposes>({
  name: 'bootstrap-2-3-2-command-root',
  modules: asCommandRoot.modules,
  setup(def) {
    const behavior = asCommandRoot();
    // Command is an inline Proto extension, not the historical Typeahead plugin.
    def.feedback.style.use(tw('relative flex min-w-0 w-full flex-col items-stretch gap-[6px]'));
    return behavior.render;
  },
});
