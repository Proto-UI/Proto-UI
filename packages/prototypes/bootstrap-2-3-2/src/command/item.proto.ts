import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandItem,
  type CommandItemProps,
  type CommandItemExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandItemProps, CommandItemExposes>({
  name: 'bootstrap-2-3-2-command-item',
  modules: asCommandItem.modules,
  setup(def) {
    const behavior = asCommandItem();
    def.feedback.style.use(
      tw(
        'flex min-w-0 items-center gap-[8px] cursor-pointer select-none px-[14px] py-[4px] text-[14px] font-normal leading-[20px] text-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('active')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('selected')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('font-bold')),
    });
    return behavior.render;
  },
});
