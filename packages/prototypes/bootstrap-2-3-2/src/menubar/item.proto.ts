import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarItem,
  type MenubarItemProps,
  type MenubarItemExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarItemProps, MenubarItemExposes>({
  name: 'bootstrap-2-3-2-menubar-item',
  modules: asMenubarItem.modules,
  setup(def) {
    const behavior = asMenubarItem();
    def.feedback.style.use(
      tw(
        'block min-w-0 px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-foreground whitespace-nowrap cursor-pointer select-none'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('focused')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    return behavior.render;
  },
});
