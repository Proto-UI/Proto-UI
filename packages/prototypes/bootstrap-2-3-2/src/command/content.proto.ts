import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandContent,
  type CommandContentProps,
  type CommandContentExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandContentProps, CommandContentExposes>({
  name: 'bootstrap-2-3-2-command-content',
  modules: asCommandContent.modules,
  setup(def) {
    const behavior = asCommandContent();
    def.feedback.style.use(
      tw(
        'min-w-[160px] rounded-[4px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground py-[5px] shadow-[0_5px_10px_rgb(0_0_0/20%)]'
      )
    );
    return behavior.render;
  },
});
