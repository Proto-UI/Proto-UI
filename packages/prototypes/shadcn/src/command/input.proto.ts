import { definePrototype, tw } from '@proto.ui/core';
import { asCommandInput, type CommandInputExposes } from '@proto.ui/prototypes-base/command';
import type { CommandInputProps } from './types';
import { setupInputShellContainment } from '../input-shell/context';
import { setupCommandStyle } from './visual';
export default definePrototype<CommandInputProps, CommandInputExposes>({
  name: 'shadcn-command-input',
  modules: asCommandInput.modules,
  setup(def) {
    const behavior = asCommandInput();
    const style = setupCommandStyle(def);
    const grouped = setupInputShellContainment(def);
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(grouped).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'rounded-md border border-input min-w-0 w-full grow bg-background px-3 py-2 text-base text-foreground outline-none'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(grouped).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'h-9 min-w-0 w-full grow rounded-none border-0 bg-transparent px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'min-w-0 w-full grow rounded-none border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.state(grouped).eq(false),
          w.state(behavior.getState!('focusVisible')!).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return () => null;
  },
});
