import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarItem,
  type MenubarItemProps as BaseMenubarItemProps,
  type MenubarItemExposes,
} from '@proto.ui/prototypes-base/menubar';
import { BRUTALIST_FOCUS_TOKENS } from '../style';

export type MenubarItemProps = BaseMenubarItemProps & {
  inset?: boolean;
  variant?: 'default' | 'destructive';
};

export default definePrototype<MenubarItemProps, MenubarItemExposes>({
  name: 'brutalist-menubar-item',
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
        'relative flex w-full min-w-0 cursor-default select-none items-center gap-2 rounded-base border-2 border-transparent px-2 py-1.5 text-left font-sans text-sm font-medium text-foreground outline-none break-words'
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
          w.any(w.state(focused).eq(true), w.state(focusVisible).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(disabled).eq(false),
          w.any(w.state(focused).eq(true), w.state(focusVisible).eq(true))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-destructive text-destructive-foreground border-black')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('pointer-events-none text-muted-foreground cursor-not-allowed')),
    });
    return behavior.render;
  },
});
