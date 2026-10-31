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
    // The bounded InputShell contract currently excludes addons. Adopt the
    // same profile's ordinary Input inset for this icon-free editor; upstream
    // Command otherwise gets its leading space from a real Search addon.
    // MIT shadcn-ui/ui@24a1642, style-*.css .cn-input. Keep NY wrapper px-3
    // and Sera's existing input/shell inset unchanged; no standalone override.
    const noAddonInsets = [
      ['vega', 'px-2.5'],
      ['nova', 'px-2.5'],
      ['maia', 'px-3'],
      ['lyra', 'px-2.5'],
      ['mira', 'px-2'],
      ['luma', 'px-3'],
      ['rhea', 'px-2.5'],
    ] as const;
    for (const [profile, inset] of noAddonInsets) {
      def.rule({
        when: (w) => w.all(w.state(style).eq(profile), w.state(grouped).eq(true)),
        intent: (i) => i.feedback.style.use(tw(inset)),
      });
    }
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
