import { definePrototype, tw } from '@proto.ui/core';
import {
  asInputRoot,
  type InputRootExposes,
  type InputRootProps,
} from '@proto.ui/prototypes-base/input';
import { COMMAND_FOCUS } from '../interactive-surface';

// HIG Text Fields informs legible rectangular editing and hints, not a native
// control implementation. This content editor remains an ordinary opaque
// surface; it is not another floating navigation/material layer.
export default definePrototype<InputRootProps, InputRootExposes>({
  name: 'liquid-glass-input-root',
  modules: asInputRoot.modules,
  setup(def) {
    const inherited = asInputRoot();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[liquid-glass-input-root] Base Input states are required.');
    def.feedback.style.use(
      tw(
        'block h-11 w-full min-w-0 rounded-2xl border border-border bg-background px-4 py-2 text-base text-foreground placeholder:text-muted-foreground outline-none'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-muted cursor-not-allowed')),
    });
    // Preserve Base's null render and the single host-owned physical editor.
    return inherited.render;
  },
});
