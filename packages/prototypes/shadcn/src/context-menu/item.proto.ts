import { definePrototype, tw } from '@proto.ui/core';
import { asContextMenuItem } from '@proto.ui/prototypes-base/context-menu';
import type { ContextMenuItemProps, ContextMenuItemExposes } from './types';
import { setupMenuItemPaint } from '../dropdown/visual';

export default definePrototype<ContextMenuItemProps, ContextMenuItemExposes>({
  name: 'shadcn-context-menu-item',
  modules: asContextMenuItem.modules,
  setup(def) {
    const behavior = asContextMenuItem();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const hovered = behavior.getState!('hovered')!;
    const active = behavior.getState!('active')!;
    const pressed = behavior.getState!('pressed')!;

    setupMenuItemPaint(
      def,
      {
        disabled,
        focused,
        focusVisible,
        hovered,
        active,
        pressed,
      },
      'context-menu'
    );

    // Highlight enabled context-menu items on pointer hover / active tracking across all profiles.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('default'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(active).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(active).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/10 text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.meta('colorScheme').eq('dark'),
          w.any(w.state(hovered).eq(true), w.state(active).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });

    return behavior.render;
  },
});
