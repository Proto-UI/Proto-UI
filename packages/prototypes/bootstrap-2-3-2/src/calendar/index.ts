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
export const calendarRoot = definePrototype({
  name: 'bootstrap-2-3-2-calendar-root',
  setup(def) {
    asCalendarRoot();
    def.feedback.style.use(
      tw(
        'inline-grid min-w-0 max-w-full gap-2 text-foreground rounded-[4px] border border-border bg-background p-3 shadow-sm'
      )
    );
  },
});
export { calendarRoot as bootstrap232CalendarRoot };
export const calendarGrid = definePrototype({
  name: 'bootstrap-2-3-2-calendar-grid',
  setup(def) {
    asCalendarGrid();
    def.feedback.style.use(tw('grid gap-1'));
  },
});
export { calendarGrid as bootstrap232CalendarGrid };
export const calendarRow = definePrototype({
  name: 'bootstrap-2-3-2-calendar-row',
  setup(def) {
    asCalendarRow();
    def.feedback.style.use(tw('grid grid-cols-7 gap-1'));
  },
});
export { calendarRow as bootstrap232CalendarRow };
export const calendarDay = definePrototype({
  name: 'bootstrap-2-3-2-calendar-day',
  setup(def) {
    const state = asCalendarDay().stateHandles;
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 min-w-0 items-center justify-center p-1 text-sm cursor-pointer rounded-[4px]'
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
export { calendarDay as bootstrap232CalendarDay };
export const calendarHeading = definePrototype({
  name: 'bootstrap-2-3-2-calendar-heading',
  setup(def) {
    const state = asCalendarHeading().stateHandles;
    def.feedback.style.use(tw('text-center text-sm font-semibold'));
    if (!state) throw new Error('Calendar heading state unavailable');
    return () => [state.month.get()];
  },
});
export { calendarHeading as bootstrap232CalendarHeading };
export const calendarPrevious = definePrototype({
  name: 'bootstrap-2-3-2-calendar-previous',
  setup(def) {
    asCalendarPrevious();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 items-center justify-center px-3 py-1 text-sm cursor-pointer rounded-[4px]'
      )
    );
  },
});
export { calendarPrevious as bootstrap232CalendarPrevious };
export const calendarNext = definePrototype({
  name: 'bootstrap-2-3-2-calendar-next',
  setup(def) {
    asCalendarNext();
    def.feedback.style.use(
      tw(
        'inline-flex min-h-9 items-center justify-center px-3 py-1 text-sm cursor-pointer rounded-[4px]'
      )
    );
  },
});
export { calendarNext as bootstrap232CalendarNext };
