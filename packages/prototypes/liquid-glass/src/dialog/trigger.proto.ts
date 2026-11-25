import { definePrototype, tw } from '@proto.ui/core';
import {
  asDialogTrigger,
  type DialogTriggerProps,
  type DialogTriggerExposes,
} from '@proto.ui/prototypes-base/dialog';
import {
  COMMAND_BLOCKED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';

export type LiquidGlassDialogTriggerProps = DialogTriggerProps & {
  prominence?: 'regular' | 'prominent';
  /** Auto enhances only when all live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
};

export default definePrototype<LiquidGlassDialogTriggerProps, DialogTriggerExposes>({
  name: 'liquid-glass-dialog-trigger',
  setup(def) {
    const behavior = asDialogTrigger();
    def.props.define({
      prominence: { type: 'enum', empty: 'fallback', options: ['regular', 'prominent'] },
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
    });
    def.props.setDefaults({ prominence: 'regular', material: 'auto' });

    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-secondary px-4 py-2 text-sm font-medium text-secondary-foreground shadow-xs outline-none cursor-pointer select-none transition-shadow'
      )
    );
    def.rule({
      when: (w) => w.prop('prominence').eq('prominent'),
      intent: (i) =>
        i.feedback.style.use(tw('border-transparent bg-primary text-primary-foreground shadow-sm')),
    });

    const state = behavior.getState!;
    const hovered = state('hovered')!;
    const pressed = state('pressed')!;
    const focusVisible = state('focusVisible')!;
    const disabled = state('disabled')!;

    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const prominence of ['regular', 'prominent'] as const) {
      for (const phase of [false, true]) {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('prominence').eq(prominence),
              w.prop('material').eq('auto'),
              w.state(disabled).eq(false),
              w.state(pressed).eq(phase)
            ),
          intent: (i) =>
            i.feedback.material.use({
              intent: 'liquid-glass',
              variant: 'regular',
              ...(prominence === 'prominent' ? { tint: 'style-fill' as const } : {}),
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
      when: (w) => w.all(w.state(hovered).eq(true), w.state(disabled).eq(false)),
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
  },
});
