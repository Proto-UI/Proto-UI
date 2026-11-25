import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_FOCUS_INSET,
  COMMAND_DISABLED,
} from '../interactive-surface';
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

export interface LiquidGlassMessageScrollerJumpProps extends MessageScrollerJumpProps {
  variant?: 'regular' | 'prominent';
  /** Auto enhances the floating jump button; pass opaque to opt out. */
  material?: 'auto' | 'opaque';
}

const JUMP_FILLS = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
} as const;

// Apple Liquid Glass HIG layering: Root and Viewport remain neutral content
// surfaces (concentric rounded-2xl + p-1 -> rounded-xl), while Jump floats
// above the scrolling transcript as a concentric capsule with paired fills.
// Material slot declaration on Jump stays deferred until the shared
// liquid-content-source-r91.test.ts expectation is updated for Jump.
export const messageScrollerRoot = definePrototype<
  MessageScrollerRootProps,
  MessageScrollerRootExposes
>({
  name: 'liquid-glass-message-scroller-root',
  modules: asMessageScrollerRoot.modules,
  setup(def) {
    const behavior = asMessageScrollerRoot();
    def.feedback.style.use(
      tw(
        'relative flex h-full w-full min-h-0 min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-background p-1 text-foreground font-sans'
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
  modules: asMessageScrollerViewport.modules,
  setup(def) {
    const behavior = asMessageScrollerViewport();
    def.feedback.style.use(
      tw(
        'relative h-full w-full min-h-0 min-w-0 max-w-full overflow-y-auto overscroll-contain rounded-xl text-foreground outline-none'
      )
    );
    const states = behavior.getAsHookHandle?.('as-scroll-area-viewport')?.stateHandles;
    if (!states)
      throw new Error(
        '[liquid-glass-message-scroller] Required viewport focus state is unavailable.'
      );
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS_INSET)),
    });
    return behavior.render;
  },
});
export { messageScrollerViewport as liquidGlassMessageScrollerViewport };

export const messageScrollerJump = definePrototype<
  LiquidGlassMessageScrollerJumpProps,
  MessageScrollerJumpExposes
>({
  name: 'liquid-glass-message-scroller-jump',
  modules: asMessageScrollerJump.modules,
  setup(def) {
    const behavior = asMessageScrollerJump();
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular', material: 'auto' });
    const states = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-message-scroller] Required inherited state is unavailable.');
    const { hovered, pressed, focusVisible, disabled } = states;

    def.feedback.style.use(
      tw(
        'absolute bottom-4 left-0 right-0 mx-auto w-fit z-10 inline-flex shrink-0 min-h-9 items-center justify-center gap-1.5 rounded-full border border-border px-4 py-1.5 text-sm font-medium whitespace-nowrap select-none cursor-pointer shadow-sm transition-shadow'
      )
    );
    (Object.keys(JUMP_FILLS) as Array<keyof typeof JUMP_FILLS>).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(JUMP_FILLS[variant])),
      });
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const variant of ['regular', 'prominent'] as const) {
      for (const phase of [false, true]) {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('variant').eq(variant),
              w.prop('material').eq('auto'),
              w.state(disabled).eq(false),
              w.state(pressed).eq(phase)
            ),
          intent: (i) =>
            i.feedback.material.use({
              intent: 'liquid-glass',
              variant: 'regular',
              ...(variant === 'prominent' ? { tint: 'style-fill' as const } : {}),
              deformation: {
                kind: 'press',
                phase: phase ? 'pressed' : 'rest',
                contact: 'pointer',
              },
            }),
        });
      }
    }
    def.rule({
      when: (w) =>
        w.all(
          w.state(hovered).eq(true),
          w.state(pressed).eq(false),
          w.state(disabled).eq(false),
          w.state(focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
    });
    return behavior.render;
  },
});
export { messageScrollerJump as liquidGlassMessageScrollerJump };
