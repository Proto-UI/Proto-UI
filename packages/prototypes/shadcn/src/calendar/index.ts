import type {
  CalendarRootProps,
  CalendarRootExposes,
  CalendarGridProps,
  CalendarGridExposes,
  CalendarRowProps,
  CalendarRowExposes,
  CalendarDayProps,
  CalendarDayExposes,
  CalendarHeadingProps,
  CalendarHeadingExposes,
  CalendarPreviousProps,
  CalendarPreviousExposes,
  CalendarNextProps,
  CalendarNextExposes,
} from '@proto.ui/prototypes-base/calendar';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asCalendarRoot,
  asCalendarGrid,
  asCalendarRow,
  asCalendarDay,
  asCalendarHeading,
  asCalendarPrevious,
  asCalendarNext,
} from '@proto.ui/prototypes-base/calendar';
export type * from '@proto.ui/prototypes-base/calendar';
export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'shadcn-calendar-root',
  setup(def) {
    asCalendarRoot();
    def.feedback.style.use(
      tw(
        'inline-grid min-w-0 max-w-full gap-2 text-foreground rounded-lg border border-border bg-background p-3 shadow-sm'
      )
    );
  },
});
export { calendarRoot as shadcnCalendarRoot };
export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'shadcn-calendar-grid',
  setup(def) {
    asCalendarGrid();
    def.feedback.style.use(tw('grid gap-1'));
  },
});
export { calendarGrid as shadcnCalendarGrid };
export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'shadcn-calendar-row',
  setup(def) {
    asCalendarRow();
    def.feedback.style.use(tw('grid grid-cols-7 gap-1'));
  },
});
export { calendarRow as shadcnCalendarRow };
export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'shadcn-calendar-day',
  setup(def) {
    const state = asCalendarDay().stateHandles;
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 min-w-0 items-center justify-center p-1 text-sm cursor-pointer rounded-md'
      )
    );
    if (!state) throw new Error('Calendar day state unavailable');
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    def.rule({
      when: (w) => w.state(state.outside).eq(true),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    return () => (state.date.get() ? [String(Number(state.date.get().slice(-2)))] : null);
  },
});
export { calendarDay as shadcnCalendarDay };
export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'shadcn-calendar-heading',
  setup(def) {
    const state = asCalendarHeading().stateHandles;
    def.feedback.style.use(tw('text-center text-sm font-semibold'));
    if (!state) throw new Error('Calendar heading state unavailable');
    return () => [state.month.get()];
  },
});
export { calendarHeading as shadcnCalendarHeading };
export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'shadcn-calendar-previous',
  setup(def) {
    asCalendarPrevious();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 items-center justify-center px-3 py-1 text-sm cursor-pointer rounded-md'
      )
    );
  },
});
export { calendarPrevious as shadcnCalendarPrevious };
export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'shadcn-calendar-next',
  setup(def) {
    asCalendarNext();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 items-center justify-center px-3 py-1 text-sm cursor-pointer rounded-md'
      )
    );
  },
});
export { calendarNext as shadcnCalendarNext };
