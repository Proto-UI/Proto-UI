import { definePrototype, tw, type State } from '@proto.ui/core';
import {
  asMessageScrollerRoot,
  asMessageScrollerViewport,
  asMessageScrollerJump,
} from '@proto.ui/prototypes-base/message-scroller';
export type * from '@proto.ui/prototypes-base/message-scroller';
export const messageScrollerRoot = definePrototype({
  name: 'shadcn-message-scroller-root',
  setup(def) {
    const behavior = asMessageScrollerRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-lg border border-border bg-background shadow-sm p-3 gap-2'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { messageScrollerRoot as shadcnMessageScrollerRoot };
export const messageScrollerViewport = definePrototype({
  name: 'shadcn-message-scroller-viewport',
  setup(def) {
    const behavior = asMessageScrollerViewport();
    def.feedback.style.use(
      tw('min-w-0 max-w-full text-foreground relative min-h-0 overflow-hidden rounded-md')
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { messageScrollerViewport as shadcnMessageScrollerViewport };
export const messageScrollerJump = definePrototype({
  name: 'shadcn-message-scroller-jump',
  setup(def) {
    const behavior = asMessageScrollerJump();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.disabled)
      def.rule({
        when: (w) => w.state(states.disabled!).eq(true),
        intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
      });
  },
});
export { messageScrollerJump as shadcnMessageScrollerJump };
