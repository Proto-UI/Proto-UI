import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuItem,
  type NavigationMenuItemProps,
  type NavigationMenuItemExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuItemProps, NavigationMenuItemExposes>({
  name: 'bootstrap-2-3-2-navigation-menu-item',
  modules: asNavigationMenuItem.modules,
  setup(def) {
    const behavior = asNavigationMenuItem();
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
