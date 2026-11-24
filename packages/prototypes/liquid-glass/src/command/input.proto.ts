import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandInput,
  type CommandInputProps,
  type CommandInputExposes,
} from '@proto.ui/prototypes-base/command';
import { COMMAND_BLOCKED, COMMAND_FOCUS, COMMAND_FOCUSED_ELEVATION } from '../interactive-surface';
export default definePrototype<CommandInputProps, CommandInputExposes>({
  name: 'liquid-glass-command-input',
  modules: asCommandInput.modules,
  setup(def) {
    const behavior = asCommandInput();
    def.feedback.style.use(
      tw(
        'w-full min-w-0 grow rounded-xl border border-border bg-secondary px-3 py-2 font-sans text-sm text-foreground placeholder:text-muted-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('no-preference'),
      intent: (i) => i.feedback.style.use(tw('transition-colors duration-150')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(behavior.getState!('focused')!).eq(true),
          w.state(behavior.getState!('disabled')!).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUSED_ELEVATION)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(`${COMMAND_BLOCKED} bg-muted text-muted-foreground`)),
    });
    return behavior.render;
  },
});
