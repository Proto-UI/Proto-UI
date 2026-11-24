import { definePrototype, tw } from '@proto.ui/core';
import {
  asNavigationMenuLink,
  type NavigationMenuLinkProps,
  type NavigationMenuLinkExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export default definePrototype<NavigationMenuLinkProps, NavigationMenuLinkExposes>({
  name: 'bootstrap-2-3-2-navigation-menu-link',
  modules: asNavigationMenuLink.modules,
  setup(def) {
    const behavior = asNavigationMenuLink();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('hovered', false);
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'reason: pointer entered bootstrap nav link');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: pointer left bootstrap nav link');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: pointer cancelled bootstrap nav link');
    });
    def.feedback.style.use(
      tw(
        'block min-w-0 px-[20px] py-[4px] text-[14px] font-normal leading-[20px] text-foreground no-underline cursor-pointer outline-none break-words'
      )
    );
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-[#999] cursor-default')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.any(
            w.state(focused).eq(true),
            w.state(hovered).eq(true),
            w.prop('current').eq(true)
          ),
          w.state(disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    return behavior.render;
  },
});
