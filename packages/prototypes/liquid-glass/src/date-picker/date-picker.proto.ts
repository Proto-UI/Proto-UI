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
export const datePickerRoot = definePrototype<DatePickerRootProps, DatePickerRootExposes>({
  name: 'liquid-glass-date-picker-root',
  setup(def) {
    const behavior = asDatePickerRoot();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground inline-grid gap-2'));
    return behavior.render;
  },
});
export { datePickerRoot as liquidGlassDatePickerRoot };
export const datePickerTrigger = definePrototype<DatePickerTriggerProps, DatePickerTriggerExposes>({
  name: 'liquid-glass-date-picker-trigger',
  setup(def) {
    const behavior = asDatePickerTrigger();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-popover-trigger')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-date-picker] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default shadow-none')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    return behavior.render;
  },
});
export { datePickerTrigger as liquidGlassDatePickerTrigger };
export const datePickerContent = definePrototype<DatePickerContentProps, DatePickerContentExposes>({
  name: 'liquid-glass-date-picker-content',
  setup(def) {
    const behavior = asDatePickerContent();
    const states = behavior.getAsHookHandle?.('as-popover-content')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-date-picker] Required inherited popup state is unavailable.');
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-secondary-foreground rounded-2xl border border-border bg-secondary shadow-lg p-3'
      )
    );
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.rule({
      when: (w) => w.state(states.open).eq(true),
      intent: (i) => i.feedback.material.use({ intent: 'liquid-glass', variant: 'regular' }),
    });
    return behavior.render;
  },
});
export { datePickerContent as liquidGlassDatePickerContent };
export const datePickerDay = definePrototype<DatePickerDayProps, DatePickerDayExposes>({
  name: 'liquid-glass-date-picker-day',
  setup(def) {
    const behavior = asDatePickerDay();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md p-1 cursor-pointer'
      )
    );
    const states = behavior.getAsHookHandle?.('as-calendar-day')?.stateHandles;
    if (!states)
      throw new Error('[liquid-glass-date-picker] Required inherited state is unavailable.');
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('cursor-default shadow-none')),
    });
    // Presentation consumes the existing owner; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-xs')),
    });
    return behavior.render;
  },
});
export { datePickerDay as liquidGlassDatePickerDay };
export const datePickerValue = definePrototype<DatePickerValueProps, DatePickerValueExposes>({
  name: 'liquid-glass-date-picker-value',
  setup(def) {
    const behavior = asDatePickerValue();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground text-sm'));
    return behavior.render;
  },
});
export { datePickerValue as liquidGlassDatePickerValue };
