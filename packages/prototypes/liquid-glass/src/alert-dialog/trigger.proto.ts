import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import {
  asAlertDialogTrigger,
  type AlertDialogTriggerExposes,
} from '@proto.ui/prototypes-base/alert-dialog';
import type { LiquidGlassAlertDialogProminence, LiquidGlassAlertDialogTriggerProps } from './types';

const FILLS: Record<LiquidGlassAlertDialogProminence, string> = {
  regular: 'bg-secondary text-secondary-foreground border-border',
  prominent: 'bg-primary text-primary-foreground border-transparent',
  destructive: 'bg-destructive text-destructive-foreground border-transparent',
};

export default definePrototype<LiquidGlassAlertDialogTriggerProps, AlertDialogTriggerExposes>({
  name: 'liquid-glass-alert-dialog-trigger',
  modules: asAlertDialogTrigger.modules,
  setup(def) {
    def.props.define({
      variant: {
        type: 'enum',
        options: ['regular', 'prominent', 'destructive'],
        empty: 'fallback',
      },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular', material: 'auto' });
    const behavior = asAlertDialogTrigger();
    const state = behavior.getState!;
    const hovered = state('hovered')!;
    const pressed = state('pressed')!;
    const focusVisible = state('focusVisible')!;
    const disabled = state('disabled')!;

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border px-5 py-2 text-sm font-medium whitespace-nowrap select-none cursor-pointer shadow-sm outline-none'
      )
    );
    (Object.keys(FILLS) as LiquidGlassAlertDialogProminence[]).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(FILLS[variant])),
      });
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const variant of ['regular', 'prominent', 'destructive'] as const) {
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
              ...(variant !== 'regular' ? { tint: 'style-fill' as const } : {}),
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
          w.state(focusVisible).eq(false),
          w.state(disabled).eq(false)
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
