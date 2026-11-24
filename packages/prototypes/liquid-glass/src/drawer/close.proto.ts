import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_BLOCKED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import { asDrawerClose, type DrawerCloseExposes } from '@proto.ui/prototypes-base/drawer';
import type { DrawerCloseProps } from './types';

const FILLS = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
} as const;

export default definePrototype<DrawerCloseProps, DrawerCloseExposes>({
  name: 'liquid-glass-drawer-close',
  setup(def) {
    const behavior = asDrawerClose();
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular' });

    const state = behavior.getState!;
    const hovered = state('hovered')!;
    const pressed = state('pressed')!;
    const focusVisible = state('focusVisible')!;
    const disabled = state('disabled')!;

    // Interior control inside the glass sheet stays non-glass to avoid stacking glass-on-glass.
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border px-5 py-2 text-sm font-medium whitespace-nowrap select-none cursor-pointer shadow-sm outline-none'
      )
    );
    (Object.keys(FILLS) as Array<keyof typeof FILLS>).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
      });
    });

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
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });

    return behavior.render;
  },
});
