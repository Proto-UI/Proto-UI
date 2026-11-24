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
    const disabled = behavior.getState!('disabled')!;
    const expanded = behavior.getState!('expanded')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('hovered', false);
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'reason: pointer entered bootstrap nav trigger');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: pointer left bootstrap nav trigger');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: pointer cancelled bootstrap nav trigger');
    });
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 items-center justify-center gap-[6px] rounded-[5px] mr-[2px] my-[2px] px-[12px] py-[8px] text-[14px] font-normal leading-[14px] text-[#08c] cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.state(expanded).eq(false),
          w.any(w.state(focused).eq(true), w.state(hovered).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#eee] text-[#005580]')),
    });
    def.rule({
      when: (w) => w.all(w.state(expanded).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-[#999] text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    return behavior.render;
  },
});
