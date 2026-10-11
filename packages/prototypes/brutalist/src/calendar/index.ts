import type {
  CalendarRootProps,
  CalendarRootExposes,
  CalendarCaptionProps,
  CalendarCaptionExposes,
  CalendarGridProps,
  CalendarGridExposes,
  CalendarWeekdaysProps,
  CalendarWeekdaysExposes,
  CalendarWeekdayProps,
  CalendarWeekdayExposes,
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
  asCalendarCaption,
  asCalendarGrid,
  asCalendarWeekdays,
  asCalendarWeekday,
  asCalendarRow,
  asCalendarDay,
  asCalendarHeading,
  asCalendarPrevious,
  asCalendarNext,
} from '@proto.ui/prototypes-base/calendar';
export type * from '@proto.ui/prototypes-base/calendar';

// Visual recipe: neobrutalism-components Calendar at 3306a802.
// The root has a hard shadow; day and navigation controls use noShadow geometry.
// Upstream font-base maps to the family sans/medium pair; see THIRD_PARTY_NOTICES.md.

export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'brutalist-calendar-root',
  setup(def) {
    const state = asCalendarRoot().stateHandles;
    if (!state) throw new Error('Calendar root state unavailable');
    def.feedback.style.use(
      tw(
        'inline-grid w-fit min-w-0 max-w-full gap-4 rounded-base border-2 border-border bg-background p-3 font-heading font-bold text-foreground shadow-[4px_4px_0_0_#000]'
      )
    );
    def.rule({
      when: (w) => w.state(state.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('direction-ltr')),
    });
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    return (render) => render.slot();
  },
});
export { calendarRoot as brutalistCalendarRoot };

export const calendarCaption = definePrototype<CalendarCaptionProps, CalendarCaptionExposes>({
  name: 'brutalist-calendar-caption',
  setup(def) {
    asCalendarCaption();
    def.feedback.style.use(tw('flex h-7 w-full items-center justify-between gap-1'));
    return (render) => render.slot();
  },
});
export { calendarCaption as brutalistCalendarCaption };

export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'brutalist-calendar-grid',
  setup(def) {
    asCalendarGrid();
    def.feedback.style.use(tw('grid w-full'));
    return (render) => render.slot();
  },
});
export { calendarGrid as brutalistCalendarGrid };

export const calendarWeekdays = definePrototype<CalendarWeekdaysProps, CalendarWeekdaysExposes>({
  name: 'brutalist-calendar-weekdays',
  setup(def) {
    asCalendarWeekdays();
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return (render) => render.slot();
  },
});
export { calendarWeekdays as brutalistCalendarWeekdays };

export const calendarWeekday = definePrototype<CalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'brutalist-calendar-weekday',
  setup(def) {
    const inherited = asCalendarWeekday();
    def.feedback.style.use(
      tw(
        'w-9 rounded-base text-center text-[0.8rem] font-sans font-medium text-foreground select-none'
      )
    );
    return inherited.render;
  },
});
export { calendarWeekday as brutalistCalendarWeekday };

export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'brutalist-calendar-row',
  setup(def) {
    asCalendarRow();
    def.feedback.style.use(tw('mt-2 grid w-full grid-cols-7'));
    return (render) => render.slot();
  },
});
export { calendarRow as brutalistCalendarRow };

export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'brutalist-calendar-day',
  setup(def) {
    const inherited = asCalendarDay();
    const state = inherited.stateHandles;
    if (!state) throw new Error('Calendar day state unavailable');
    def.feedback.style.use(
      tw(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background p-0 text-center text-sm font-sans font-medium text-foreground select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.today).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
    });
    def.rule({
      when: (w) => w.state(state.outside).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'z-10 outline-none ring-2 ring-ring ring-offset-2 ring-offset-background forced-colors-focus-outline'
          )
        ),
    });
    return inherited.render;
  },
});
export { calendarDay as brutalistCalendarDay };

export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'brutalist-calendar-heading',
  setup(def) {
    const state = asCalendarHeading().stateHandles;
    if (!state) throw new Error('Calendar heading state unavailable');
    def.feedback.style.use(
      tw('min-w-0 flex-1 text-center text-sm font-heading font-bold select-none')
    );
    return () => [state.displayValue.get()];
  },
});
export { calendarHeading as brutalistCalendarHeading };

export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'brutalist-calendar-previous',
  setup(def) {
    const state = asCalendarPrevious().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background p-0 text-sm font-sans font-medium text-foreground select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none ring-2 ring-ring ring-offset-2 ring-offset-background forced-colors-focus-outline'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return (render) => render.slot();
  },
});
export { calendarPrevious as brutalistCalendarPrevious };

export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'brutalist-calendar-next',
  setup(def) {
    const state = asCalendarNext().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background p-0 text-sm font-sans font-medium text-foreground select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'outline-none ring-2 ring-ring ring-offset-2 ring-offset-background forced-colors-focus-outline'
          )
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return (render) => render.slot();
  },
});
export { calendarNext as brutalistCalendarNext };
