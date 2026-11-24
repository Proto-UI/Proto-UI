import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarTrigger,
  type MenubarTriggerProps,
  type MenubarTriggerExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarTriggerProps, MenubarTriggerExposes>({
  name: 'bootstrap-2-3-2-menubar-trigger',
  modules: asMenubarTrigger.modules,
  setup(def) {
    const behavior = asMenubarTrigger();
    const disabled = behavior.getState!('disabled')!;
    const expanded = behavior.getState!('expanded')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 items-center justify-center rounded-[4px] px-[12px] py-[7px] text-[14px] font-normal leading-[18px] cursor-pointer select-none outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('colorScheme').eq('dark')),
          w.state(disabled).eq(false),
          w.state(expanded).eq(false),
          w.state(focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-[#555]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.state(disabled).eq(false),
          w.state(expanded).eq(false),
          w.state(focused).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('colorScheme').eq('dark')),
          w.state(disabled).eq(false),
          w.state(expanded).eq(false),
          w.state(focused).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#e5e5e5] text-[#333]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.state(disabled).eq(false),
          w.state(expanded).eq(false),
          w.state(focused).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.not(w.meta('colorScheme').eq('dark')),
          w.state(expanded).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'bg-[#e5e5e5] text-[#333] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.meta('colorScheme').eq('dark'),
          w.state(expanded).eq(true),
          w.state(disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
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
