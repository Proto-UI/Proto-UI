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
import { definePrototype, tw, type State } from '@proto.ui/core';
import {
  asDatePickerRoot,
  asDatePickerTrigger,
  asDatePickerContent,
  asDatePickerDay,
  asDatePickerValue,
} from '@proto.ui/prototypes-base/date-picker';
export type * from '@proto.ui/prototypes-base/date-picker';
export const datePickerRoot = definePrototype<DatePickerRootProps, DatePickerRootExposes>({
  name: 'brutalist-date-picker-root',
  setup(def) {
    const behavior = asDatePickerRoot();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground inline-grid gap-2'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { datePickerRoot as brutalistDatePickerRoot };
export const datePickerTrigger = definePrototype<DatePickerTriggerProps, DatePickerTriggerExposes>({
  name: 'brutalist-date-picker-trigger',
  setup(def) {
    const behavior = asDatePickerTrigger();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm cursor-pointer'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { datePickerTrigger as brutalistDatePickerTrigger };
export const datePickerContent = definePrototype<DatePickerContentProps, DatePickerContentExposes>({
  name: 'brutalist-date-picker-content',
  setup(def) {
    const behavior = asDatePickerContent();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground rounded-none border-2 border-border bg-background shadow-md p-3'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { datePickerContent as brutalistDatePickerContent };
export const datePickerDay = definePrototype<DatePickerDayProps, DatePickerDayExposes>({
  name: 'brutalist-date-picker-day',
  setup(def) {
    const behavior = asDatePickerDay();
    def.feedback.style.use(
      tw(
        'min-w-0 max-w-full text-foreground inline-flex min-h-9 items-center justify-center rounded-md p-1 cursor-pointer'
      )
    );
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { datePickerDay as brutalistDatePickerDay };
export const datePickerValue = definePrototype<DatePickerValueProps, DatePickerValueExposes>({
  name: 'brutalist-date-picker-value',
  setup(def) {
    const behavior = asDatePickerValue();
    def.feedback.style.use(tw('min-w-0 max-w-full text-foreground text-sm'));
    const states = behavior.stateHandles as Record<string, State<boolean>> | undefined;
    if (states?.focusVisible)
      def.rule({
        when: (w) => w.state(states.focusVisible!).eq(true),
        intent: (i) =>
          i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
      });
    if (states?.selected)
      def.rule({
        when: (w) => w.state(states.selected!).eq(true),
        intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
      });
    return behavior.render;
  },
});
export { datePickerValue as brutalistDatePickerValue };
