import {
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_PRESS_TOKENS,
} from '../style';
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
  name: 'brutalist-message-scroller-root',
  modules: asMessageScrollerRoot.modules,
  setup(def) {
    const behavior = asMessageScrollerRoot();
    def.feedback.style.use(
      tw(
        'relative flex h-full w-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-base border-2 border-black bg-secondary-background text-foreground shadow-[4px_4px_0_0_#000] font-sans font-medium'
      )
    );
    return behavior.render;
  },
});
export { messageScrollerRoot as brutalistMessageScrollerRoot };

export const messageScrollerViewport = definePrototype<
  MessageScrollerViewportProps,
  MessageScrollerViewportExposes
>({
  name: 'brutalist-message-scroller-viewport',
  modules: asMessageScrollerViewport.modules,
  setup(def) {
    const behavior = asMessageScrollerViewport();
    def.feedback.style.use(
      tw(
        'relative h-full w-full min-h-0 min-w-0 max-w-full overflow-y-auto overscroll-contain rounded-none text-foreground font-sans font-medium outline-none'
      )
    );
    const states = behavior.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!states)
      throw new Error('[brutalist-message-scroller] Required viewport focus state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-inset forced-colors-focus-outline')
        ),
    });
    return behavior.render;
  },
});
export { messageScrollerViewport as brutalistMessageScrollerViewport };

export const messageScrollerJump = definePrototype<
  MessageScrollerJumpProps,
  MessageScrollerJumpExposes
>({
  name: 'brutalist-message-scroller-jump',
  modules: asMessageScrollerJump.modules,
  setup(def) {
    const behavior = asMessageScrollerJump();
    def.feedback.style.use(
      tw(
        'absolute bottom-4 right-4 z-10 inline-flex shrink-0 min-h-9 items-center justify-center gap-1.5 rounded-base border-2 border-black bg-main text-main-foreground shadow-[4px_4px_0_0_#000] px-3 py-1.5 font-sans text-sm font-medium whitespace-nowrap select-none cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states)
      throw new Error('[brutalist-message-scroller] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_FOCUS_TOKENS} forced-colors-focus-outline`)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(`${BRUTALIST_DISABLED_TOKENS} cursor-default shadow-none`)),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    // Jump is already positioned `absolute`, so keep its containing block
    // intact instead of adding `relative` alongside the hit-envelope helper.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(`${BRUTALIST_PRESS_TOKENS} hit-envelope-translate-1`)),
    });
    return behavior.render;
  },
});
export { messageScrollerJump as brutalistMessageScrollerJump };
