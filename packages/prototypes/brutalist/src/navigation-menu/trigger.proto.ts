import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import {
  asNavigationMenuTrigger,
  type NavigationMenuTriggerProps,
  type NavigationMenuTriggerExposes,
} from '@proto.ui/prototypes-base/navigation-menu';

export default definePrototype<NavigationMenuTriggerProps, NavigationMenuTriggerExposes>({
  name: 'brutalist-navigation-menu-trigger',
  modules: asNavigationMenuTrigger.modules,
  setup(def) {
    const behavior = asNavigationMenuTrigger();
    const disabled = behavior.getState!('disabled')!;
    const expanded = behavior.getState!('expanded')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = def.state.bool('hovered', false);
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'reason: pointer entered brutalist nav trigger');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: pointer left brutalist nav trigger');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: pointer cancelled brutalist nav trigger');
    });
    def.feedback.style.use(
      tw(
        'inline-flex h-9 min-w-0 cursor-pointer select-none items-center justify-center gap-1 rounded-base border-2 border-transparent bg-main px-3 py-1.5 text-sm text-main-foreground font-sans font-medium outline-none transition-colors'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(expanded).eq(true), w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-secondary-background text-foreground border-black')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    return behavior.render;
  },
});
