import { definePrototype, tw } from '@proto.ui/core';
import { asInputRoot } from '@proto.ui/prototypes-base/input';
import type { BrutalistInputRootExposes, BrutalistInputRootProps } from './types';

/** Neo input.tsx at 3306a802; Base remains the only editor and value owner. */
export const BrutalistInputRoot = definePrototype<
  BrutalistInputRootProps,
  BrutalistInputRootExposes
>({
  name: 'brutalist-input-root',
  modules: asInputRoot.modules,
  setup(def) {
    const inherited = asInputRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[brutalist-input] Base Input state handles are required.');
    def.feedback.style.use(
      tw(
        'flex h-10 w-full rounded-base border-2 border-border bg-secondary-background px-3 py-2 text-sm font-sans font-medium text-foreground placeholder:text-muted-foreground selection:bg-main selection:text-main-foreground'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none forced-colors-focus-outline ring-2 ring-offset-2 ring-offset-background')
        ),
    });
    // Light mode keeps literal #000000 (`ring-black`) even under customized `--ring`;
    // dark mode switches exclusively to `ring-ring` (#f5f5f5) without colliding in cascade.
    def.rule({
      when: (w) =>
        w.all(w.state(state.focusVisible).eq(true), w.not(w.meta('colorScheme').eq('dark'))),
      intent: (i) => i.feedback.style.use(tw('ring-black')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.focusVisible).eq(true), w.meta('colorScheme').eq('dark')),
      intent: (i) => i.feedback.style.use(tw('ring-ring')),
    });
    def.rule({
      when: (w) => w.state(state.readOnly).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-not-allowed opacity-50')),
    });
    return inherited.render;
  },
});
export default BrutalistInputRoot;
