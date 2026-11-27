import { definePrototype, type RunHandle, tw } from '@proto.ui/core';
import { COMMAND_DISABLED, COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asNavigationMenuLink,
  type NavigationMenuLinkProps,
  type NavigationMenuLinkExposes,
} from '@proto.ui/prototypes-base/navigation-menu';
import { LIQUID_GLASS_NAVIGATION_CONTENT_PAINT } from './content.proto';

export default definePrototype<NavigationMenuLinkProps, NavigationMenuLinkExposes>({
  name: 'liquid-glass-navigation-menu-link',
  modules: asNavigationMenuLink.modules,
  setup(def) {
    const behavior = asNavigationMenuLink();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const content = def.state.bool('navigationContentPaint', false);
    const syncContent = (run: RunHandle<NavigationMenuLinkProps>) =>
      content.set(
        run.context.tryRead(LIQUID_GLASS_NAVIGATION_CONTENT_PAINT)?.content === true,
        'reason: owned Liquid Glass Navigation Content boundary'
      );
    def.context.trySubscribe(LIQUID_GLASS_NAVIGATION_CONTENT_PAINT, syncContent);
    def.lifecycle.onCreated(syncContent);
    def.lifecycle.onMounted(syncContent);
    def.lifecycle.onUpdated(syncContent);
    const hovered = def.state.bool('hovered', false);
    def.event.on('pointer.enter', () => {
      if (!disabled.get()) hovered.set(true, 'reason: pointer entered liquid-glass nav link');
    });
    def.event.on('pointer.leave', () => {
      hovered.set(false, 'reason: pointer left liquid-glass nav link');
    });
    def.event.on('pointer.cancel', () => {
      hovered.set(false, 'reason: pointer cancelled on liquid-glass nav link');
    });
    def.feedback.style.use(
      tw(
        'flex w-full min-w-0 cursor-pointer select-none items-center rounded-xl px-3 py-2 text-sm font-medium text-secondary-foreground text-left no-underline outline-none transition-colors break-words'
      )
    );
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(
            w.state(focused).eq(true),
            w.all(w.state(content).eq(false), w.state(hovered).eq(true))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.prop('current').eq(true),
          w.state(focused).eq(false),
          w.any(w.state(content).eq(true), w.state(hovered).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    return behavior.render;
  },
});
