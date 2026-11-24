import { definePrototype, tw } from '@proto.ui/core';
import { COMMAND_BLOCKED, COMMAND_FOCUS_INSET } from '../interactive-surface';
import {
  asMenubarTrigger,
  type MenubarTriggerProps,
  type MenubarTriggerExposes,
} from '@proto.ui/prototypes-base/menubar';
export default definePrototype<MenubarTriggerProps, MenubarTriggerExposes>({
  name: 'liquid-glass-menubar-trigger',
  modules: asMenubarTrigger.modules,
  setup(def) {
    const behavior = asMenubarTrigger();
    const disabled = behavior.getState!('disabled')!;
    const expanded = behavior.getState!('expanded')!;
    const focused = behavior.getState!('focused')!;
    const focusVisible = behavior.getState!('focusVisible')!;
    def.feedback.style.use(
      tw(
        'inline-flex min-w-0 cursor-pointer select-none items-center justify-center rounded-xl px-3 py-1.5 text-sm font-medium text-secondary-foreground outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.state(expanded).eq(false),
          w.state(focused).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(disabled).eq(false), w.state(expanded).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground shadow-xs')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_BLOCKED} text-muted-foreground`)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    return behavior.render;
  },
});
