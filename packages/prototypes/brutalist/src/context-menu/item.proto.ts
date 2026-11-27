import { definePrototype, tw } from '@proto.ui/core';
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
  name: 'brutalist-context-menu-item',
  modules: asContextMenuItem.modules,
  setup(def) {
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
      variant: { type: 'enum', empty: 'fallback', options: ['default', 'destructive'] },
    });
    def.props.setDefaults({ inset: false, variant: 'default' });

    const behavior = asContextMenuItem();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    const active = behavior.getState!('active')!;
    const pressed = behavior.getState!('pressed')!;

    def.feedback.style.use(
      tw(
        'relative flex w-full min-w-0 cursor-default select-none items-center gap-2 rounded-base border-2 border-transparent bg-secondary-background px-2 py-1.5 text-left font-sans text-sm font-medium text-foreground outline-none break-words'
      )
    );
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-8')),
    });
    def.rule({
      when: (w) => w.prop('variant').eq('destructive'),
      intent: (i) => i.feedback.style.use(tw('text-destructive-ink')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('default'),
          w.state(disabled).eq(false),
          w.any(
            w.state(active).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true),
            w.state(pressed).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.any(
            w.state(active).eq(true),
            w.state(focused).eq(true),
            w.state(focusVisible).eq(true),
            w.state(pressed).eq(true)
          )
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-destructive text-destructive-foreground border-black')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('cursor-not-allowed bg-secondary-background text-muted-foreground border-transparent')
        ),
    });
    return behavior.render;
  },
});
