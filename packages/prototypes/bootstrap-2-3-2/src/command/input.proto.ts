import { definePrototype, tw } from '@proto.ui/core';
import {
  asCommandInput,
  type CommandInputProps,
  type CommandInputExposes,
} from '@proto.ui/prototypes-base/command';
export default definePrototype<CommandInputProps, CommandInputExposes>({
  name: 'bootstrap-2-3-2-command-input',
  modules: asCommandInput.modules,
  setup(def) {
    const behavior = asCommandInput();
    def.feedback.style.use(
      tw(
        'rounded border border-border min-w-0 grow bg-background px-3 py-2 text-base text-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return () => null;
  },
});
