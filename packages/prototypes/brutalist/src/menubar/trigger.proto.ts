import { definePrototype, tw } from '@proto.ui/core';
import {
  asMenubarTrigger,
  type MenubarTriggerProps,
  type MenubarTriggerExposes,
} from '@proto.ui/prototypes-base/menubar';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
export default definePrototype<MenubarTriggerProps, MenubarTriggerExposes>({
  name: 'brutalist-menubar-trigger',
  modules: asMenubarTrigger.modules,
  setup(def) {
    const behavior = asMenubarTrigger();
    const disabled = behavior.getState!('disabled')!;
    const expanded = behavior.getState!('expanded')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 cursor-pointer select-none items-center justify-center rounded-base border-2 border-transparent px-3 py-1.5 font-sans text-sm font-medium text-foreground outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(expanded).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground border-black')),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-not-allowed`)),
    });
    return behavior.render;
  },
});
