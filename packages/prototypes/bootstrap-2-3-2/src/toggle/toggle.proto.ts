import { definePrototype, tw } from '@proto.ui/core';
import { asToggle, type ToggleExposes, type ToggleProps } from '@proto.ui/prototypes-base/toggle';
import {
  bootstrapButtonDefaultSize,
  bootstrapButtonFlatFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonPressed,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonRestFill,
} from '../button/paint';

export interface BootstrapToggleProps extends ToggleProps {
  variant?: 'default' | 'primary' | 'warning' | 'danger' | 'success' | 'info' | 'inverse';
  size?: 'default' | 'large' | 'small' | 'mini';
}

// Design-language extension: Base Toggle owns active state; Bootstrap 2.3.2
// stateful .btn is only the visual reference, not a copied jQuery behavior.
// Source attribution: ../../THIRD_PARTY_NOTICES.md.
export default definePrototype<BootstrapToggleProps, ToggleExposes>({
  name: 'bootstrap-2-3-2-toggle',
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['default', 'primary', 'warning', 'danger', 'success', 'info', 'inverse'],
        empty: 'fallback',
      },
      size: {
        type: 'enum',
        options: ['default', 'large', 'small', 'mini'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({
      variant: 'default',
      size: 'default',
    });

    const inherited = asToggle();
    const state = inherited.stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-toggle] Base state handles required.');
    const { active, disabled, hovered, focused, focusVisible, pressed } = state;

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center gap-1 border font-sans font-normal leading-[20px] text-center align-middle whitespace-nowrap select-none cursor-pointer transition-none',
        bootstrapButtonRaised
      )
    );

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

    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
        ),
      intent: (i) =>
        i.feedback.style.use(tw('transition-[background-position] duration-100 ease-linear')),
    });

    (Object.keys(bootstrapButtonRestFill) as Array<keyof typeof bootstrapButtonRestFill>).forEach(
      (variant) => {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('variant').eq(variant),
              w.state(disabled).eq(false),
              w.state(pressed).eq(false),
              w.state(active).eq(false),
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
              w.state(active).eq(false),
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
                  w.any(w.state(pressed).eq(true), w.state(active).eq(true)),
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
              w.any(w.state(pressed).eq(true), w.state(active).eq(true)),
              w.any(w.state(hovered).eq(true), w.state(focused).eq(true))
            ),
          intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill[variant])),
        });
      }
    );

    def.rule({
      when: (w) =>
        w.all(
          w.state(disabled).eq(false),
          w.any(w.state(pressed).eq(true), w.state(active).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
    });
    def.rule({
      when: (w) => w.state(focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none ring-2 ring-ring ring-offset-2 ring-offset-background forced-colors-focus-outline'
          )
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
