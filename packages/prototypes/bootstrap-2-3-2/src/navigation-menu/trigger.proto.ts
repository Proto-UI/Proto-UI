import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuTrigger,
  type NavigationMenuTriggerProps,
  type NavigationMenuTriggerExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
export default definePrototype<NavigationMenuTriggerProps, NavigationMenuTriggerExposes>({
  name: 'bootstrap-2-3-2-navigation-menu-trigger',
  modules: asNavigationMenuTrigger.modules,
  setup(def) {
    const behavior = asNavigationMenuTrigger();
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 items-center justify-center rounded-[5px] mr-[2px] my-[2px] px-[12px] py-[8px] text-[14px] font-normal leading-[14px] text-[#08c] cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('disabled')!).eq(false),
          w.state(behavior.getState!('expanded')!).eq(false),
          w.state(behavior.getState!('focused')!).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee] text-[#005580]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('expanded')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#999] text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    return behavior.render;
  },
});
