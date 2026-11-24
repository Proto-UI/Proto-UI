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
  name: 'bootstrap-2-3-2-context-menu-item',
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

    def.feedback.style.use(
      tw(
        'flex min-w-0 items-center gap-2 px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-foreground whitespace-nowrap cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-7')),
    });
    def.rule({
      when: (w) => w.all(w.prop('variant').eq('destructive'), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
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
          w.prop('variant').eq('default'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true), w.state(active).eq(true))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true), w.state(active).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive text-primary-foreground')),
    });
    return behavior.render;
  },
});
