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

// Proto extension: Bootstrap 2.3.2 supplies the typography, panel chrome and
// Button vocabulary, not a message log, end-follow policy or second scroll owner.
export const messageScrollerRoot = definePrototype<
  MessageScrollerRootProps,
  MessageScrollerRootExposes
>({
  name: 'bootstrap-2-3-2-message-scroller-root',
  modules: asMessageScrollerRoot.modules,
  setup(def) {
    const inherited = asMessageScrollerRoot();
    def.feedback.style.use(
      tw(
        'relative flex h-full w-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-[4px] border border-border bg-background text-foreground font-sans text-[14px] leading-[20px] shadow-[inset_0_1px_1px_rgb(0_0_0/7.5%)]'
      )
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
  modules: asMessageScrollerViewport.modules,
  setup(def) {
    const inherited = asMessageScrollerViewport();
    const viewport = inherited.getAsHookHandle!('as-scroll-area-viewport');
    if (!viewport?.stateHandles)
      throw new Error('[bootstrap-2-3-2-message-scroller-viewport] Base focus facts required.');
    def.feedback.style.use(
      tw(
        'relative h-full w-full min-h-0 min-w-0 max-w-full overflow-y-auto overscroll-contain outline-none'
      )
    );
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
  modules: asMessageScrollerJump.modules,
  setup(def) {
    const inherited = asMessageScrollerJump();
    const button = inherited.getAsHookHandle!('as-button');
    if (!button?.stateHandles)
      throw new Error('[bootstrap-2-3-2-message-scroller-jump] Base Button facts required.');
    setupButtonVisual(def, button.stateHandles);
    def.feedback.style.use(tw('absolute bottom-3 right-4 z-10'));
    return inherited.render;
  },
});
export { messageScrollerJump as bootstrap232MessageScrollerJump };
