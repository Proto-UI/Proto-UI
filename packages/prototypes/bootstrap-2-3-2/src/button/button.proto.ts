import { definePrototype, tw } from '@proto.ui/core';
import { asButton, type ButtonExposes } from '@proto.ui/prototypes-base/button';

export interface ButtonProjectionProps {
  variant?: 'default' | 'primary';
  disabled?: boolean;
}

// Independently expressed Proto UI projection of Bootstrap v2.3.2 buttons.less.
// Changed from upstream: Base owns all interaction/a11y; scalable token spacing,
// a stronger focus ring, no legacy browser hacks, text-shadow or jQuery plugin.
// Upstream source attribution and license: ../../THIRD_PARTY_NOTICES.md.
const FILLS = {
  default: 'bg-[linear-gradient(#fff,#e6e6e6)] text-foreground border-border',
  primary: 'bg-[linear-gradient(#08c,#04c)] text-primary-foreground border-primary',
};
const HOVER = { default: 'bg-[#e6e6e6]', primary: 'bg-[#04c]' };

export default definePrototype<ButtonProjectionProps, ButtonExposes>({
  name: 'bootstrap-2-3-2-button',
  setup(def) {
    def.props.define({
      variant: { type: 'enum', options: ['default', 'primary'], empty: 'fallback' },
      disabled: { type: 'boolean', empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'default', disabled: false });
    const state = asButton().stateHandles;
    if (!state) throw new Error('[bootstrap-2-3-2-button] Base Button states are required.');
    const { hovered, pressed, focusVisible, disabled } = state;

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-3 py-1 text-sm font-normal leading-5 whitespace-nowrap select-none cursor-pointer shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
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
      def.rule({
        when: (w) => w.all(w.prop('variant').eq(variant), w.state(pressed).eq(true)),
        intent: (i) => i.feedback.style.use(tw(HOVER[variant])),
      });
      def.rule({
        when: (w) => w.all(w.prop('variant').eq(variant), w.state(disabled).eq(true)),
        intent: (i) => i.feedback.style.use(tw(HOVER[variant])),
      });
    });
    def.rule({
      when: (w) => w.state(pressed).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]')),
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
  },
});
