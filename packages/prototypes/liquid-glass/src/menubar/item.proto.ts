import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_DISABLED, COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asMenubarItem,
  type MenubarItemProps as BaseMenubarItemProps,
  type MenubarItemExposes,
} from '@proto.ui/prototypes-base/menubar';

export type MenubarItemProps = BaseMenubarItemProps & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
};

export default definePrototype<MenubarItemProps, MenubarItemExposes>({
  name: 'liquid-glass-menubar-item',
  modules: asMenubarItem.modules,
  setup(def) {
    def.props.define({
      inset: { type: 'boolean', empty: 'fallback' },
      variant: { type: 'enum', options: ['default', 'destructive'], empty: 'fallback' },
    });
    def.props.setDefaults({ inset: false, variant: 'default' });
    const behavior = asMenubarItem();
    const disabled = behavior.getState!('disabled')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.feedback.style.use(
      tw(
        'relative flex min-w-0 cursor-default select-none items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium text-secondary-foreground outline-none break-words'
      )
    );
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-8')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.state(focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-destructive')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('default'),
          w.state(focused).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(focused).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-destructive text-destructive-foreground')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_DISABLED} text-muted-foreground`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    return behavior.render;
  },
});
