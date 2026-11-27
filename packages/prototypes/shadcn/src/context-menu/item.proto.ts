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
    const active = behavior.getState!('active')!;
    const pressed = behavior.getState!('pressed')!;

    setupMenuItemPaint(
      def,
      {
        disabled,
        focused,
        focusVisible,
        active,
        pressed,
      },
      'context-menu'
    );

    // Pointer navigation reaches active through Base Focus handoff; hovered alone
    // must not leave a second painted row behind when focus moves elsewhere.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('default'),
          w.state(disabled).eq(false),
          w.state(active).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.state(active).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/10 text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.meta('colorScheme').eq('dark'),
          w.state(active).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive/20')),
    });

    return behavior.render;
  },
});
