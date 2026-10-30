import { definePrototype, tw } from '@proto.ui/core';
import { asCommandInput, type CommandInputExposes } from '@proto.ui/prototypes-base/command';
import type { CommandInputProps } from './types';
import { setupInputShellContainment } from '../input-shell/context';
import { setupCommandPartPaint } from './visual';
export default definePrototype<CommandInputProps, CommandInputExposes>({
  name: 'shadcn-command-input',
  modules: asCommandInput.modules,
  setup(def) {
    const behavior = asCommandInput();
    const style = setupCommandPartPaint(def, 'input');
    const grouped = setupInputShellContainment(def);
    def.feedback.style.use(
      tw(
        'min-w-0 w-full grow border-0 bg-transparent text-foreground outline-none placeholder:text-muted-foreground'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(style).eq('new-york-v4'), w.state(grouped).eq(false)),
      intent: (i) => i.feedback.style.use(tw('rounded-md')),
    });
    def.rule({
      when: (w) => w.any(w.not(w.state(style).eq('new-york-v4')), w.state(grouped).eq(true)),
      intent: (i) => i.feedback.style.use(tw('rounded-none')),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
    return () => null;
  },
});
