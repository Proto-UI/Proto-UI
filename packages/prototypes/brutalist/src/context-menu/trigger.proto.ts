import { definePrototype, tw } from '@proto.ui/core';
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
import {
  asContextMenuTrigger,
  type ContextMenuTriggerProps,
  type ContextMenuTriggerExposes,
} from '@proto.ui/prototypes-base/context-menu';

export default definePrototype<ContextMenuTriggerProps, ContextMenuTriggerExposes>({
  name: 'brutalist-context-menu-trigger',
  modules: asContextMenuTrigger.modules,
  setup(def) {
    const behavior = asContextMenuTrigger();
    // Keep Trigger headless like neobrutalism.dev so consumers own trigger box framing.
    def.feedback.style.use(
      tw('min-w-0 font-sans font-medium text-foreground outline-none select-none')
    );
    def.rule({
      when: (w) => w.state(behavior.getState!('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS)),
    });
    def.rule({
      when: (w) => w.state(behavior.getState!('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS)),
    });
    return behavior.render;
  },
});
