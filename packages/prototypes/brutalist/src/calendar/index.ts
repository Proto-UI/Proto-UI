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
  name: 'brutalist-calendar-root',
  setup(def) {
    asCalendarRoot();
    def.feedback.style.use(
      tw(
        'inline-grid min-w-0 max-w-full gap-2 text-foreground rounded-none border-2 border-border bg-background p-4 shadow-md'
      )
    );
  },
});
export { calendarRoot as brutalistCalendarRoot };
export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'brutalist-calendar-grid',
  setup(def) {
    asCalendarGrid();
    def.feedback.style.use(tw('grid gap-1'));
  },
});
export { calendarGrid as brutalistCalendarGrid };
export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'brutalist-calendar-row',
  setup(def) {
    asCalendarRow();
    def.feedback.style.use(tw('grid grid-cols-7 gap-1'));
  },
});
export { calendarRow as brutalistCalendarRow };
export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'brutalist-calendar-day',
  setup(def) {
    const state = asCalendarDay().stateHandles;
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 min-w-0 items-center justify-center p-1 text-sm cursor-pointer rounded-none border-2 border-border'
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
export { calendarDay as brutalistCalendarDay };
export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'brutalist-calendar-heading',
  setup(def) {
    const state = asCalendarHeading().stateHandles;
    def.feedback.style.use(tw('text-center text-sm font-semibold'));
    if (!state) throw new Error('Calendar heading state unavailable');
    return () => [state.month.get()];
  },
});
export { calendarHeading as brutalistCalendarHeading };
export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'brutalist-calendar-previous',
  setup(def) {
    asCalendarPrevious();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 items-center justify-center px-3 py-1 text-sm cursor-pointer rounded-none border-2 border-border'
      )
    );
  },
});
export { calendarPrevious as brutalistCalendarPrevious };
export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'brutalist-calendar-next',
  setup(def) {
    asCalendarNext();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 items-center justify-center px-3 py-1 text-sm cursor-pointer rounded-none border-2 border-border'
      )
    );
  },
});
export { calendarNext as brutalistCalendarNext };
