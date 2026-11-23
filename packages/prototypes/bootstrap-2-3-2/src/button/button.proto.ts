import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonExposes } from '@proto.ui/prototypes-base/button';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonDefaultSize,
  bootstrapButtonPressed,
} from './paint';

export interface ButtonProjectionProps {
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success' | 'info' | 'inverse';
  size?: 'default' | 'large' | 'small' | 'mini';
  disabled?: boolean;
  /** Opt-in blue navigation palette; Base still owns the command interaction. */
  colorContext?: 'default' | 'navbar';
  /** Allow long labels to grow vertically instead of forcing one clipped line. */
  wrap?: boolean;
}

// Independently expressed Proto UI projection of Bootstrap v2.3.2 buttons.less.
// Changed from upstream: Base owns all interaction/a11y; original pixel dimensions,
// a stronger focus ring, reduced-motion cancellation, no legacy browser hacks or jQuery plugin.
// Upstream source attribution and license: ../../THIRD_PARTY_NOTICES.md.

export default definePrototype<ButtonProjectionProps, ButtonExposes>({
  name: 'bootstrap-2-3-2-button',
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['default', 'primary', 'warning', 'danger', 'success', 'info', 'inverse'],
        empty: 'fallback',
      },
      size: { type: 'enum', options: ['default', 'large', 'small', 'mini'], empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
      colorContext: { type: 'enum', options: ['default', 'navbar'], empty: 'fallback' },
      wrap: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({
      variant: 'default',
      size: 'default',
      disabled: false,
      wrap: false,
      colorContext: 'default',
    });
    const inherited = asButton();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-button] Base Button states are required.');
    const { hovered, pressed, focused, focusVisible, disabled } = state;

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center border font-normal leading-[20px] select-none cursor-pointer transition-none'
      )
    );
    // buttons.less deliberately animates only entry into hover/focus. Removing
    // this Rule cancels interpolation immediately; no reverse transition or
    // extra event/timer owner is introduced. The Web style projection owns the
    // host's reduced-motion override for this finite paint-only transition.
    def.rule({
      when: (w) =>
        w.all(
          w.prop('colorContext').eq('default'),
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('transition-[background-position] duration-100 ease-linear')),
    });
    def.rule({
      when: (w) => w.prop('wrap').eq(false),
      intent: (i) => i.feedback.style.use(tw('whitespace-nowrap')),
    });
    def.rule({
      when: (w) => w.prop('wrap').eq(true),
      intent: (i) => i.feedback.style.use(tw('h-auto min-h-8 whitespace-normal')),
    });
    // v2.3.2 keeps a 20px line height in every size. All size-dependent
    // dimensions are exclusive rules, including default, so no size competes.
    const sizes = {
      default: bootstrapButtonDefaultSize,
      large: 'px-[19px] py-[11px] text-[17.5px] rounded-[6px]',
      small: 'px-[10px] py-[2px] text-[11.9px] rounded-[3px]',
      mini: 'px-[6px] py-[0px] text-[10.5px] rounded-[3px]',
    };
    (Object.keys(sizes) as Array<keyof typeof sizes>).forEach((size) => {
      def.rule({
        when: (w) => w.prop('size').eq(size),
        intent: (i) => i.feedback.style.use(tw(sizes[size])),
      });
    });
    def.rule({
      when: (w) => w.prop('colorContext').eq('default'),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRaised)),
    });
    def.rule({
      when: (w) => w.all(w.prop('colorContext').eq('default'), w.prop('variant').eq('default')),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
          )
        ),
    });
    def.rule({
      when: (w) =>
        w.all(w.prop('colorContext').eq('default'), w.not(w.prop('variant').eq('default'))),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
          )
        ),
    });
    (Object.keys(bootstrapButtonRestFill) as Array<keyof typeof bootstrapButtonRestFill>).forEach(
      (variant) => {
        // State paint is exclusive: disabled/pressed flatten the image; hover or
        // any focus preserves it at the upstream endpoint. The separate finite
        // transition Rule controls entry interpolation without changing paint.
        def.rule({
          when: (w) =>
            w.all(
              w.prop('colorContext').eq('default'),
              w.prop('variant').eq(variant),
              w.state(disabled).eq(false),
              w.state(pressed).eq(false),
              w.state(hovered).eq(false),
              w.not(w.state(focused).eq(true))
            ),
          intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill[variant])),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.prop('colorContext').eq('default'),
              w.prop('variant').eq(variant),
              w.state(disabled).eq(false),
              w.state(pressed).eq(false),
              w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
            ),
          intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill[variant])),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.prop('colorContext').eq('default'),
              w.prop('variant').eq(variant),
              w.any(
                w.state(disabled).eq(true),
                w.all(
                  w.state(pressed).eq(true),
                  w.state(hovered).eq(false),
                  w.not(w.state(focused).eq(true))
                )
              )
            ),
          intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill[variant])),
        });
        def.rule({
          when: (w) =>
            w.all(
              w.prop('colorContext').eq('default'),
              w.prop('variant').eq(variant),
              w.state(disabled).eq(false),
              w.state(pressed).eq(true),
              w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
            ),
          intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill[variant])),
        });
      }
    );
    def.rule({
      when: (w) => w.all(w.state(pressed).eq(true), w.state(disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.all(w.prop('colorContext').eq('default'), w.state(focusVisible).eq(true)),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    // A family-owned navigation palette. Its transparent resting state keeps
    // commands in one navbar; observed Base states supply all feedback.
    def.rule({
      when: (w) => w.prop('colorContext').eq('navbar'),
      intent: (i) =>
        i.feedback.style.use(tw('border-transparent text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('colorContext').eq('navbar'),
          w.any(
            w.state(disabled).eq(true),
            w.all(
              w.state(pressed).eq(false),
              w.state(hovered).eq(false),
              w.not(w.state(focused).eq(true))
            )
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-transparent shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('colorContext').eq('navbar'),
          w.state(disabled).eq(false),
          w.state(pressed).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-black/10 shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.prop('colorContext').eq('navbar'),
          w.state(disabled).eq(false),
          w.state(pressed).eq(true)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-black/20')),
    });
    def.rule({
      when: (w) => w.all(w.prop('colorContext').eq('navbar'), w.state(focusVisible).eq(true)),
      intent: (i) =>
        i.feedback.style.use(tw('forced-colors-focus-outline ring-2 ring-white ring-offset-0')),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('opacity-65 pointer-events-none cursor-default shadow-none')),
    });
    return inherited.render;
  },
});
