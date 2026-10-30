import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandEmpty,
  type CommandEmptyProps,
  type CommandEmptyExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandEmptyProps, CommandEmptyExposes>({
  name: 'bootstrap-2-3-2-command-empty',
  modules: asCommandEmpty.modules,
  setup(def) {
    const behavior = asCommandEmpty();
    def.feedback.style.use(tw('px-[20px] py-[3px] text-[14px] leading-[20px] text-[#999]'));
    return behavior.render;
  },
});
