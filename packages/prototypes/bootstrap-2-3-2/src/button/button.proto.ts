import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonExposes } from '@proto.ui/prototypes-base/button';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from './paint';

export interface ButtonProjectionProps {
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success' | 'info' | 'inverse';
  size?: 'default' | 'large' | 'small' | 'mini';
  disabled?: boolean;
}

// Independently expressed Proto UI projection of Bootstrap v2.3.2 buttons.less.
// Changed from upstream: Base owns all interaction/a11y; original pixel dimensions,
// a stronger focus ring, no legacy browser hacks or jQuery plugin; background-position motion remains open.
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
    });
    def.props.setDefaults({ variant: 'default', size: 'default', disabled: false });
    const inherited = asButton();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-button] Base Button states are required.');
    const { hovered, pressed, focused, focusVisible, disabled } = state;

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center border font-normal leading-[20px] whitespace-nowrap select-none cursor-pointer'
      )
    );
    // v2.3.2 keeps a 20px line height in every size. All size-dependent
    // dimensions are exclusive rules, including default, so no size competes.
    const sizes = {
      default: 'px-[12px] py-[4px] text-[14px] rounded-[4px]',
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
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) => w.prop('variant').eq('default'),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.not(w.prop('variant').eq('default')),
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
        // any focus preserves it at the upstream endpoint. No motion is claimed.
        def.rule({
          when: (w) =>
            w.all(
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
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none ring-2 ring-ring ring-offset-2 ring-offset-background')
        ),
    });
    def.rule({
      when: (w) => w.state(disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('opacity-65 pointer-events-none cursor-default shadow-none')),
    });
    return inherited.render;
  },
});
