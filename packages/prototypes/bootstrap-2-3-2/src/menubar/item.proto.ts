import { definePrototype, tw } from '@proto.ui/core';
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
  name: 'bootstrap-2-3-2-menubar-item',
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
        'flex min-w-0 items-center gap-[8px] px-[20px] py-[3px] text-[14px] font-normal leading-[20px] text-foreground whitespace-nowrap cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) => w.prop('inset').eq(true),
      intent: (i) => i.feedback.style.use(tw('pl-[32px]')),
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
      intent: (i) =>
        i.feedback.style.use(tw('bg-[linear-gradient(#08c,#0077b3)] text-primary-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('variant').eq('destructive'),
          w.state(focused).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#da4f49_linear-gradient(#ee5f5b,#bd362f)_0_0_repeat-x] text-primary-foreground')
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('text-muted-foreground cursor-default pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-inset ring-ring')),
    });
    return behavior.render;
  },
});
