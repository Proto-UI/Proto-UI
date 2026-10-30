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
import { setupButtonVisual } from '../button/visual';
export type * from '@proto.ui/prototypes-base/message-scroller';

// Proto extension: Bootstrap 2.3.2 supplies the typography and Button vocabulary,
// not a message log, end-follow policy or a second scrolling implementation.
export const messageScrollerRoot = definePrototype<
  MessageScrollerRootProps,
  MessageScrollerRootExposes
>({
  name: 'bootstrap-2-3-2-message-scroller-root',
  setup(def) {
    const inherited = asMessageScrollerRoot();
    def.feedback.style.use(
      tw('relative min-w-0 min-h-0 max-w-full text-foreground text-[14px] leading-[20px]')
    );
    return inherited.render;
  },
});
export { messageScrollerRoot as bootstrap232MessageScrollerRoot };

export const messageScrollerViewport = definePrototype<
  MessageScrollerViewportProps,
  MessageScrollerViewportExposes
>({
  name: 'bootstrap-2-3-2-message-scroller-viewport',
  setup(def) {
    const inherited = asMessageScrollerViewport();
    const viewport = inherited.getAsHookHandle!('as-scroll-area-viewport');
    if (!viewport?.stateHandles)
      throw new Error('[bootstrap-2-3-2-message-scroller-viewport] Base focus facts required.');
    def.feedback.style.use(tw('relative min-w-0 min-h-0 max-w-full outline-none'));
    def.rule({
      when: (w) => w.state(viewport.stateHandles!.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-inset forced-colors-focus-outline')),
    });
    return inherited.render;
  },
});
export { messageScrollerViewport as bootstrap232MessageScrollerViewport };

export const messageScrollerJump = definePrototype<
  MessageScrollerJumpProps,
  MessageScrollerJumpExposes
>({
  name: 'bootstrap-2-3-2-message-scroller-jump',
  setup(def) {
    const inherited = asMessageScrollerJump();
    const button = inherited.getAsHookHandle!('as-button');
    if (!button?.stateHandles)
      throw new Error('[bootstrap-2-3-2-message-scroller-jump] Base Button facts required.');
    setupButtonVisual(def, button.stateHandles);
    return inherited.render;
  },
});
export { messageScrollerJump as bootstrap232MessageScrollerJump };
