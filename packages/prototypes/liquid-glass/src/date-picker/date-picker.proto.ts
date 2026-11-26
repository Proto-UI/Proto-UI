import {
  COMMAND_HOVER,
  COMMAND_PRESS,
  COMMAND_FOCUS,
  COMMAND_DISABLED,
} from '../interactive-surface';
import type {
  DatePickerRootProps,
  DatePickerRootExposes,
  DatePickerTriggerProps,
  DatePickerTriggerExposes,
  DatePickerContentProps,
  DatePickerContentExposes,
  DatePickerDayProps,
  DatePickerDayExposes,
  DatePickerValueProps,
  DatePickerValueExposes,
} from '@proto.ui/prototypes-base/date-picker';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asDatePickerRoot,
  asDatePickerTrigger,
  asDatePickerContent,
  asDatePickerDay,
  asDatePickerValue,
} from '@proto.ui/prototypes-base/date-picker';
export type * from '@proto.ui/prototypes-base/date-picker';

export interface LiquidGlassDatePickerTriggerProps extends DatePickerTriggerProps {
  variant?: 'regular' | 'prominent';
  /** Auto enhances only when all live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
}

export interface LiquidGlassDatePickerContentProps extends DatePickerContentProps {
  /** Auto enhances only when all live preference/support inputs are affirmative. */
  material?: 'auto' | 'opaque';
}

const TRIGGER_FILLS = {
  regular: 'bg-secondary text-secondary-foreground',
  prominent: 'bg-primary text-primary-foreground',
} as const;

export const datePickerRoot = definePrototype<DatePickerRootProps, DatePickerRootExposes>({
  name: 'liquid-glass-date-picker-root',
  modules: asDatePickerRoot.modules,
  setup(def) {
    const behavior = asDatePickerRoot();
    const calendar = behavior.getAsHookHandle?.('as-calendar-root')?.stateHandles;
    if (!calendar)
      throw new Error('[liquid-glass-date-picker] Required inherited state is unavailable.');
    def.feedback.style.use(tw('inline-grid min-w-0 max-w-full gap-2 font-sans text-foreground'));
    def.rule({
      when: (w) => w.state(calendar.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('direction-ltr')),
    });
    def.rule({
      when: (w) => w.state(calendar.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    return behavior.render;
  },
});
export { datePickerRoot as liquidGlassDatePickerRoot };

export const datePickerTrigger = definePrototype<
  LiquidGlassDatePickerTriggerProps,
  DatePickerTriggerExposes
>({
  name: 'liquid-glass-date-picker-trigger',
  modules: asDatePickerTrigger.modules,
  setup(def) {
    def.props.define({
      variant: { type: 'enum', options: ['regular', 'prominent'], empty: 'fallback' },
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ variant: 'regular', material: 'auto' });
    const behavior = asDatePickerTrigger();
    const states = behavior.getAsHookHandle?.('as-popover-trigger')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-date-picker] Required inherited state is unavailable.');
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full inline-flex min-h-9 items-center justify-between gap-2 rounded-full border border-border px-4 py-2 font-sans text-sm font-medium text-start select-none cursor-pointer shadow-sm transition-shadow'
      )
    );
    (Object.keys(TRIGGER_FILLS) as Array<keyof typeof TRIGGER_FILLS>).forEach((variant) => {
      def.rule({
        when: (w) => w.prop('variant').eq(variant),
        intent: (i) => i.feedback.style.use(tw(TRIGGER_FILLS[variant])),
      });
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    for (const variant of ['regular', 'prominent'] as const) {
      for (const phase of [false, true]) {
        def.rule({
          when: (w) =>
            w.all(
              w.prop('variant').eq(variant),
              w.prop('material').eq('auto'),
              w.state(states.disabled).eq(false),
              w.state(states.pressed).eq(phase)
            ),
          intent: (i) =>
            i.feedback.material.use({
              intent: 'liquid-glass',
              variant: 'regular',
              ...(variant === 'prominent' ? { tint: 'style-fill' as const } : {}),
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
          w.state(states.hovered).eq(true),
          w.state(states.pressed).eq(false),
          w.state(states.disabled).eq(false),
          w.state(states.focusVisible).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw(COMMAND_HOVER)),
    });
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(COMMAND_PRESS)),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED, 'bg-muted text-muted-foreground')),
    });
    return behavior.render;
  },
});
export { datePickerTrigger as liquidGlassDatePickerTrigger };

export const datePickerContent = definePrototype<
  LiquidGlassDatePickerContentProps,
  DatePickerContentExposes
>({
  name: 'liquid-glass-date-picker-content',
  modules: asDatePickerContent.modules,
  setup(def) {
    def.props.define({
      material: { type: 'enum', options: ['auto', 'opaque'], empty: 'fallback' },
    });
    def.props.setDefaults({ material: 'auto' });
    const behavior = asDatePickerContent();
    const popover = behavior.getAsHookHandle?.('as-popover-content');
    const states = popover?.stateHandles;
    if (!popover || !states)
      throw new Error('[liquid-glass-date-picker] Required inherited popup state is unavailable.');
    popover.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    // Floating regular Liquid Glass layer with concentric rounded-2xl geometry and subtle inset rim.
    def.feedback.style.use(
      tw(
        'z-50 grid w-auto min-w-0 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto gap-3 rounded-2xl border border-border bg-secondary text-secondary-foreground ring-1 ring-inset ring-border shadow-lg p-3 font-sans outline-none'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.open).eq(true),
          w.state(popover.asTransition.transitionState).eq('entering'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-in fade-in-0 zoom-in-95 duration-150')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.open).eq(false),
          w.state(popover.asTransition.transitionState).eq('leaving'),
          w.meta('preference.reducedMotion').eq('no-preference')
        ),
      intent: (i) => i.feedback.style.use(tw('animate-out fade-out-0 zoom-out-95 duration-150')),
    });
    def.rule({
      when: (w) => w.meta('preference.reducedMotion').eq('reduce'),
      intent: (i) => i.feedback.style.use(tw('animate-none transition-none')),
    });
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.all(w.state(states.open).eq(true), w.prop('material').eq('auto')),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    return behavior.render;
  },
});
export { datePickerContent as liquidGlassDatePickerContent };

export const datePickerDay = definePrototype<DatePickerDayProps, DatePickerDayExposes>({
  name: 'liquid-glass-date-picker-day',
  modules: asDatePickerDay.modules,
  setup(def) {
    const behavior = asDatePickerDay();
    const states = behavior.getAsHookHandle?.('as-calendar-day')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-date-picker] Required inherited state is unavailable.');
    // Concentric circular day cells sit directly on the popup glass layer (never glass-on-glass).
    def.feedback.style.use(
      tw(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-center font-sans text-sm font-medium text-foreground select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.hovered).eq(true),
          w.state(states.disabled).eq(false),
          w.state(states.selected).eq(false),
          w.state(states.rangeMiddle).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground shadow-xs')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.pressed).eq(true),
          w.state(states.disabled).eq(false),
          w.state(states.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted shadow-none')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.rangePending).eq(true),
          w.state(states.disabled).eq(false),
          w.state(states.selected).eq(false),
          w.state(states.rangeMiddle).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(states.selected).eq(true), w.state(states.rangeMiddle).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground font-semibold')),
    });
    def.rule({
      when: (w) => w.state(states.rangeMiddle).eq(true),
      intent: (i) => i.feedback.style.use(tw('rounded-none bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(states.today).eq(true), w.state(states.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-background text-primary font-semibold')),
    });
    def.rule({
      when: (w) => w.all(w.state(states.outside).eq(true), w.state(states.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED, 'text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10', COMMAND_FOCUS)),
    });
    return behavior.render;
  },
});
export { datePickerDay as liquidGlassDatePickerDay };

export const datePickerValue = definePrototype<DatePickerValueProps, DatePickerValueExposes>({
  name: 'liquid-glass-date-picker-value',
  modules: asDatePickerValue.modules,
  setup(def) {
    const behavior = asDatePickerValue();
    def.feedback.style.use(tw('min-w-0 max-w-full font-sans text-sm text-start text-inherit'));
    return behavior.render;
  },
});
export { datePickerValue as liquidGlassDatePickerValue };
