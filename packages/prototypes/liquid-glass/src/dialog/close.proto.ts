import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogClose,
  type DialogCloseProps,
  type DialogCloseExposes,
} from '@proto.ui/prototypes-base/dialog';
import {
  COMMAND_BLOCKED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';

export type LiquidGlassDialogCloseProps = DialogCloseProps & {
  prominence?: 'regular' | 'prominent' | 'destructive';
};

export default definePrototype<LiquidGlassDialogCloseProps, DialogCloseExposes>({
  name: 'liquid-glass-dialog-close',
  setup(def) {
    const behavior = asDialogClose();
    def.props.define({
      prominence: {
        type: 'enum',
        empty: 'fallback',
        options: ['regular', 'prominent', 'destructive'],
      },
    });
    def.props.setDefaults({ prominence: 'regular' });

    // Concentric pill inside the rounded-2xl glass sheet; never stacks glass material.
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-xs outline-none cursor-pointer select-none transition-all'
      )
    );
    def.rule({
      when: (w) => w.prop('prominence').eq('prominent'),
      intent: (i) =>
        i.feedback.style.use(tw('border-transparent bg-primary text-primary-foreground shadow-sm')),
    });
    def.rule({
      when: (w) => w.prop('prominence').eq('destructive'),
      intent: (i) =>
        i.feedback.style.use(
          tw('border-transparent bg-destructive text-destructive-foreground shadow-sm')
        ),
    });

    const state = behavior.getState!;
    def.rule({
      when: (w) =>
        w.all(w.state(state('hovered')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) =>
        w.all(w.state(state('pressed')!).eq(true), w.state(state('disabled')!).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(state('focusVisible')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state('disabled')!).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_BLOCKED)),
    });
  },
});
