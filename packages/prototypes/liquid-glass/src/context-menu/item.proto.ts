import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_DISABLED_FOCUSABLE, COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asContextMenuItem,
  type ContextMenuItemProps as BaseContextMenuItemProps,
  type ContextMenuItemExposes,
} from '@proto.ui/prototypes-base/context-menu';

export type ContextMenuItemProps = BaseContextMenuItemProps & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
};

export default definePrototype<ContextMenuItemProps, ContextMenuItemExposes>({
  name: 'liquid-glass-context-menu-item',
  modules: asContextMenuItem.modules,
  setup(def) {
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'destructive'] },
    });
    def.props.setDefaults({ inset: false, variant: 'default' });

    const behavior = asContextMenuItem();
    const disabled = behavior.getState!('disabled')!;
    const hovered = behavior.getState!('hovered')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const active = behavior.getState!('active')!;

    // Concentric 12px (rounded-xl) item inside 16px (rounded-2xl) + 4px (p-1) floating glass panel.
    def.feedback.style.use(
      tw(
        'relative flex w-full min-w-0 cursor-default select-none items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium outline-none break-words'
      )
    );
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-8')),
    });
    def.rule({
      when: (w) => w.all(w.prop('variant').eq('destructive'), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED_FOCUSABLE, 'text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('default'),
          w.state(disabled).eq(false),
          w.any(
            w.state(hovered).eq(true),
            w.state(active).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.any(
            w.state(hovered).eq(true),
            w.state(active).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive text-destructive-foreground')),
    });
    return behavior.render;
  },
});
