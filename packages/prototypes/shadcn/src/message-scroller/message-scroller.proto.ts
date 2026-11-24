import type {
  MessageScrollerRootProps,
  MessageScrollerRootExposes,
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
import {
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';
import { setupMessageJumpPaint, type ShadcnMessageScrollerJumpSize } from './visual';
export type * from '@proto.ui/prototypes-base/message-scroller';
export type { ShadcnMessageScrollerJumpSize } from './visual';
export type ShadcnMessageScrollerRootProps = MessageScrollerRootProps & ShadcnStyleProps;
export type ShadcnMessageScrollerViewportProps = ShadcnStyleProps;
export type ShadcnMessageScrollerJumpProps = MessageScrollerJumpProps &
  ShadcnStyleProps & {
    size?: ShadcnMessageScrollerJumpSize;
  };

// shadcn-ui/ui@3d98900e: bases/base/ui/message-scroller.tsx and the
// independently retained new-york-v4/ui/message-scroller.tsx. The Base
// protocol owns while-at-end follow and the currently bounded three parts.
export const messageScrollerRoot = definePrototype<
  ShadcnMessageScrollerRootProps,
  MessageScrollerRootExposes
>({
  name: 'shadcn-message-scroller-root',
  modules: asMessageScrollerRoot.modules,
  setup(def) {
    const inherited = asMessageScrollerRoot();
    setupShadcnStyleScope(def);
    def.feedback.style.use(
      tw('relative flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden')
    );
    return inherited.render;
  },
});
export { messageScrollerRoot as shadcnMessageScrollerRoot };

export const messageScrollerViewport = definePrototype<
  ShadcnMessageScrollerViewportProps,
  MessageScrollerViewportExposes
>({
  name: 'shadcn-message-scroller-viewport',
  modules: asMessageScrollerViewport.modules,
  setup(def) {
    const inherited = asMessageScrollerViewport();
    const style = setupShadcnStyleSelection(def, 'new-york-v4');
    const state = inherited.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!state)
      throw new Error('[shadcn-message-scroller] Required viewport focus state is unavailable.');
    // The inherited Scroll Surface alone owns while-at-end follow, requests,
    // reader interruption and system/composed negotiation. Paint cannot
    // convert an ordinary system scroller into clipped, non-scrollable content.
    def.feedback.style.use(
      tw('h-full w-full min-h-0 min-w-0 overflow-y-auto overscroll-contain outline-none')
    );
    def.rule({
      when: (w) => w.all(w.state(state.focusVisible).eq(true), w.state(style).eq('lyra')),
      intent: (i) =>
        i.feedback.style.use(tw('ring-1 ring-ring/50 ring-inset forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.focusVisible).eq(true),
          w.any(w.state(style).eq('mira'), w.state(style).eq('sera'))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring/30 ring-inset forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.focusVisible).eq(true),
          w.any(w.state(style).eq('luma'), w.state(style).eq('rhea'))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('ring-3 ring-ring/30 ring-inset forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.focusVisible).eq(true),
          w.any(
            w.state(style).eq('vega'),
            w.state(style).eq('nova'),
            w.state(style).eq('maia'),
            w.state(style).eq('new-york-v4')
          )
        ),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-inset forced-colors-focus-outline')),
    });
    return inherited.render;
  },
});
export { messageScrollerViewport as shadcnMessageScrollerViewport };

export const messageScrollerJump = definePrototype<
  ShadcnMessageScrollerJumpProps,
  MessageScrollerJumpExposes
>({
  name: 'shadcn-message-scroller-jump',
  modules: asMessageScrollerJump.modules,
  setup(def) {
    const inherited = asMessageScrollerJump();
    const state = inherited.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[shadcn-message-scroller] Required inherited Button state is unavailable.');
    setupMessageJumpPaint(def, state);
    return inherited.render;
  },
});
export { messageScrollerJump as shadcnMessageScrollerJump };
