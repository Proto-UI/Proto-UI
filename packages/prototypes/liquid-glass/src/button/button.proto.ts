import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonExposes } from '@proto.ui/prototypes-base/button';

export interface ButtonProjectionProps {
  variant?: 'regular' | 'prominent';
  disabled?: boolean;
}

// The deterministic opaque, non-moving accessibility fallback only.
// #793 gates the reactive preference/support boundary before enabling blur or
// alpha. This is not Apple's material engine and does not complete #792.
const FILLS = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
};
const HOVER = { regular: 'bg-muted', prominent: 'bg-primary' };

export default definePrototype<ButtonProjectionProps, ButtonExposes>({
  name: 'liquid-glass-button',
  setup(def) {
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular', disabled: false });
    const state = asButton().stateHandles;
    if (!state) throw new Error('[liquid-glass-button] Base Button states are required.');
    const { hovered, pressed, focusVisible, disabled } = state;

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium whitespace-nowrap select-none cursor-pointer shadow-sm'
      )
    );
    (Object.keys(FILLS) as Array<keyof typeof FILLS>).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
      });
      def.rule({
        when: (w) => w.all(w.prop('variant').eq(variant), w.state(hovered).eq(true)),
        intent: (i) => i.feedback.style.use(tw(HOVER[variant])),
      });
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
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
      intent: (i) => i.feedback.style.use(tw('opacity-50 pointer-events-none cursor-default')),
    });
  },
});
