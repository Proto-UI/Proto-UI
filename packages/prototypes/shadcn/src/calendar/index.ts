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

// Visual recipe: shadcn/ui base-nova Calendar (2026-10-10 static reference).
// The demo owns its optional outer border; Base owns all date and focus semantics.

export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'shadcn-calendar-root',
  setup(def) {
    const state = asCalendarRoot().stateHandles;
    if (!state) throw new Error('Calendar root state unavailable');
    def.feedback.style.use(
      tw('inline-grid w-fit min-w-0 max-w-full gap-4 bg-background p-2 font-sans text-foreground')
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
export { calendarRoot as shadcnCalendarRoot };

export const calendarCaption = definePrototype<CalendarCaptionProps, CalendarCaptionExposes>({
  name: 'shadcn-calendar-caption',
  setup(def) {
    asCalendarCaption();
    def.feedback.style.use(tw('flex h-7 w-full items-center justify-between gap-1'));
    return (render) => render.slot();
  },
});
export { calendarCaption as shadcnCalendarCaption };

export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'shadcn-calendar-grid',
  setup(def) {
    asCalendarGrid();
    def.feedback.style.use(tw('grid w-full'));
    return (render) => render.slot();
  },
});
export { calendarGrid as shadcnCalendarGrid };

export const calendarWeekdays = definePrototype<CalendarWeekdaysProps, CalendarWeekdaysExposes>({
  name: 'shadcn-calendar-weekdays',
  setup(def) {
    asCalendarWeekdays();
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return (render) => render.slot();
  },
});
export { calendarWeekdays as shadcnCalendarWeekdays };

export const calendarWeekday = definePrototype<CalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'shadcn-calendar-weekday',
  setup(def) {
    const inherited = asCalendarWeekday();
    def.feedback.style.use(
      tw('w-7 rounded-md text-center text-[0.8rem] font-normal text-muted-foreground select-none')
    );
    return inherited.render;
  },
});
export { calendarWeekday as shadcnCalendarWeekday };

export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'shadcn-calendar-row',
  setup(def) {
    asCalendarRow();
    def.feedback.style.use(tw('mt-2 grid w-full grid-cols-7'));
    return (render) => render.slot();
  },
});
export { calendarRow as shadcnCalendarRow };

export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'shadcn-calendar-day',
  setup(def) {
    const inherited = asCalendarDay();
    const state = inherited.stateHandles;
    if (!state) throw new Error('Calendar day state unavailable');
    def.feedback.style.use(
      tw(
        'relative inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-center text-sm font-normal leading-none select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.today).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.outside).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.disabled).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('z-10 outline-none ring-3 ring-ring/50 forced-colors-focus-outline')
        ),
    });
    return inherited.render;
  },
});
export { calendarDay as shadcnCalendarDay };

export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'shadcn-calendar-heading',
  setup(def) {
    const state = asCalendarHeading().stateHandles;
    if (!state) throw new Error('Calendar heading state unavailable');
    def.feedback.style.use(tw('min-w-0 flex-1 text-center text-sm font-medium select-none'));
    return () => [state.displayValue.get()];
  },
});
export { calendarHeading as shadcnCalendarHeading };

export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'shadcn-calendar-previous',
  setup(def) {
    const state = asCalendarPrevious().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent p-0 text-sm font-medium text-foreground select-none cursor-pointer transition-colors'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none border-ring ring-3 ring-ring/50 forced-colors-focus-outline')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return (render) => render.slot();
  },
});
export { calendarPrevious as shadcnCalendarPrevious };

export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'shadcn-calendar-next',
  setup(def) {
    const state = asCalendarNext().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent bg-transparent p-0 text-sm font-medium text-foreground select-none cursor-pointer transition-colors'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw('outline-none border-ring ring-3 ring-ring/50 forced-colors-focus-outline')
        ),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return (render) => render.slot();
  },
});
export { calendarNext as shadcnCalendarNext };
