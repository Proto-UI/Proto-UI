import { definePrototype, tw } from '@proto.ui/core';
import {
  COMMAND_DISABLED,
  COMMAND_FOCUS,
  COMMAND_HOVER,
  COMMAND_PRESS,
} from '../interactive-surface';
import { asPopoverTrigger, type PopoverTriggerExposes } from '@proto.ui/prototypes-base/popover';
import type { PopoverTriggerProps } from './types';

export default definePrototype<PopoverTriggerProps, PopoverTriggerExposes>({
  name: 'liquid-glass-popover-trigger',
  modules: asPopoverTrigger.modules,
  setup(def) {
    const behavior = asPopoverTrigger();
    def.props.define({
      material: { type: 'enum', empty: 'fallback', options: ['auto', 'opaque'] },
      prominence: { type: 'enum', empty: 'fallback', options: ['regular', 'prominent'] },
    });
    def.props.setDefaults({ material: 'auto', prominence: 'regular' });
    def.feedback.style.use(
      tw(
        'inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-medium font-sans cursor-pointer outline-none select-none'
      )
    );
    def.rule({
      when: (w) => w.prop('prominence').eq('regular'),
      intent: (i) =>
        i.feedback.style.use(tw('border-border bg-secondary text-secondary-foreground shadow-xs')),
    });
    def.rule({
      when: (w) => w.prop('prominence').eq('prominent'),
      intent: (i) =>
        i.feedback.style.use(tw('border-transparent bg-primary text-primary-foreground shadow-sm')),
    });
    def.rule({
      when: (w) => w.not(w.meta('preference.reducedMotion').eq('reduce')),
      intent: (i) => i.feedback.style.use(tw('transition-shadow')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('transition-none')),
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
      when: (w) =>
        w.all(w.state(hovered).eq(true), w.state(pressed).eq(false), w.state(disabled).eq(false)),
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
