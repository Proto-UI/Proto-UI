import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import {
  asAlertDialogAction,
  type AlertDialogActionExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { LiquidGlassAlertDialogActionProps, LiquidGlassAlertDialogProminence } from './types';

const FILLS: Record<LiquidGlassAlertDialogProminence, string> = {
  prominent: 'bg-primary text-primary-foreground border-transparent',
  regular: 'bg-secondary text-secondary-foreground border-border',
  destructive: 'bg-destructive text-destructive-foreground border-transparent',
};

// Family command paint on top of the Liquid Glass Content sheet (no glass-on-glass stacking).
// AlertDialog keeps sole activation and focus ownership.
export default definePrototype<LiquidGlassAlertDialogActionProps, AlertDialogActionExposes>({
  name: 'liquid-glass-alert-dialog-action',
  modules: asAlertDialogAction.modules,
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['prominent', 'regular', 'destructive'],
        empty: 'fallback',
      },
    });
    def.props.setDefaults({ variant: 'prominent' });
    const behavior = asAlertDialogAction();
    const state = behavior.getState!;
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border px-5 py-2 text-sm font-medium select-none cursor-pointer shadow-sm min-w-0 max-w-full whitespace-normal wrap-anywhere outline-none'
      )
    );
    (Object.keys(FILLS) as LiquidGlassAlertDialogProminence[]).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
      });
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state('hovered')!).eq(true),
          w.state(state('pressed')!).eq(false),
          w.state(state('focusVisible')!).eq(false),
          w.state(state('disabled')!).eq(false)
        ),
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
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED)),
    });
    return behavior.render;
  },
});
