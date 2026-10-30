import type {
  MessageScrollerRootProps,
  MessageScrollerRootExposes,
  MessageScrollerViewportProps,
  MessageScrollerViewportExposes,
  MessageScrollerJumpProps,
  MessageScrollerJumpExposes,
} from '@proto.ui/prototypes-base/message-scroller';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asMessageScrollerRoot,
  asMessageScrollerViewport,
  asMessageScrollerJump,
} from '@proto.ui/prototypes-base/message-scroller';
export type * from '@proto.ui/prototypes-base/message-scroller';
export const messageScrollerRoot = definePrototype<
  MessageScrollerRootProps,
  MessageScrollerRootExposes
>({
  name: 'liquid-glass-message-scroller-root',
  setup(def) {
    const behavior = asMessageScrollerRoot();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-2xl border border-border bg-background p-3 gap-2'
      )
    );
    return behavior.render;
  },
});
export { messageScrollerRoot as liquidGlassMessageScrollerRoot };
export const messageScrollerViewport = definePrototype<
  MessageScrollerViewportProps,
  MessageScrollerViewportExposes
>({
  name: 'liquid-glass-message-scroller-viewport',
  setup(def) {
    const behavior = asMessageScrollerViewport();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground relative min-h-0 rounded-md'));
    const states = behavior.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!states)
      throw new Error(
        '[liquid-glass-message-scroller] Required viewport focus state is unavailable.'
      );
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { messageScrollerViewport as liquidGlassMessageScrollerViewport };
export const messageScrollerJump = definePrototype<
  MessageScrollerJumpProps,
  MessageScrollerJumpExposes
>({
  name: 'liquid-glass-message-scroller-jump',
  setup(def) {
    const behavior = asMessageScrollerJump();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-message-scroller] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default shadow-none')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    return behavior.render;
  },
});
export { messageScrollerJump as liquidGlassMessageScrollerJump };
