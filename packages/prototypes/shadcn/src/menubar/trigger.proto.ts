import { definePrototype, tw } from '@proto.ui/core';
import { asMenubarTrigger, type MenubarTriggerExposes } from '@proto.ui/prototypes-base/menubar';
import { setupMenubarStyle } from './visual';
import type { ShadcnMenubarTriggerProps } from './types';
export default definePrototype<ShadcnMenubarTriggerProps, MenubarTriggerExposes>({
  name: 'shadcn-menubar-trigger',
  setup(def) {
    const behavior = asMenubarTrigger();
    const style = setupMenubarStyle(def);
    def.feedback.style.use(
      tw('flex min-w-0 items-center outline-none select-none text-sm font-medium')
    );
    def.rule({
      when: (w) => w.state(style).eq('new-york-v4'),
      intent: (i) => i.feedback.style.use(tw('rounded-sm px-2 py-1')),
    });
    def.rule({
      when: (w) => w.state(style).eq('rhea'),
      intent: (i) => i.feedback.style.use(tw('rounded-[var(--pui-radius-2xl)] px-1.5 py-[2px]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(style).eq('new-york-v4'),
          w.any(
            w.state(behavior.getState!('focused')!).eq(true),
            w.state(behavior.getState!('expanded')!).eq(true)
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-accent text-accent-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq('rhea'), w.state(behavior.getState!('expanded')!).eq(true)),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    // Retain the existing keyboard-focus affordance while exact source focus/hover
    // and outline-hidden lowering remain tracked; expanded paint is not focus paint.
    def.rule({
      when: (w) =>
        w.all(w.state(style).eq('rhea'), w.state(behavior.getState!('focusVisible')!).eq(true)),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-inset ring-ring forced-colors-focus-outline')),
    });
    // Rhea hover remains an explicit missing Base hover fact, never a DOM selector.
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-not-allowed')),
    });
  },
});
