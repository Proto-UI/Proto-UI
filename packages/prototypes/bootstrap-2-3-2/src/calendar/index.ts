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

// Bootstrap 2.3.2 did not ship Calendar. This is a Proto UI extension using
// its button, table and form vocabulary, not a claim of an upstream Calendar.
// Base owns semantics; source attribution is in THIRD_PARTY_NOTICES.md.

export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'bootstrap-2-3-2-calendar-root',
  setup(def) {
    const state = asCalendarRoot().stateHandles;
    if (!state) throw new Error('Calendar root state unavailable');
    def.feedback.style.use(
      tw(
        'inline-grid w-fit min-w-0 max-w-full gap-2 rounded-[4px] border border-border bg-background p-2 font-sans text-sm text-foreground shadow-sm'
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
export { calendarRoot as bootstrap232CalendarRoot };

export const calendarCaption = definePrototype<CalendarCaptionProps, CalendarCaptionExposes>({
  name: 'bootstrap-2-3-2-calendar-caption',
  setup(def) {
    asCalendarCaption();
    def.feedback.style.use(tw('flex min-h-8 w-full items-center justify-between gap-2'));
    return (render) => render.slot();
  },
});
export { calendarCaption as bootstrap232CalendarCaption };

export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'bootstrap-2-3-2-calendar-grid',
  setup(def) {
    asCalendarGrid();
    def.feedback.style.use(tw('grid w-full border-t border-border'));
    return (render) => render.slot();
  },
});
export { calendarGrid as bootstrap232CalendarGrid };

export const calendarWeekdays = definePrototype<CalendarWeekdaysProps, CalendarWeekdaysExposes>({
  name: 'bootstrap-2-3-2-calendar-weekdays',
  setup(def) {
    asCalendarWeekdays();
    def.feedback.style.use(tw('grid w-full grid-cols-7 border-b border-border'));
    return (render) => render.slot();
  },
});
export { calendarWeekdays as bootstrap232CalendarWeekdays };

export const calendarWeekday = definePrototype<CalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'bootstrap-2-3-2-calendar-weekday',
  setup(def) {
    const inherited = asCalendarWeekday();
    def.feedback.style.use(tw('w-8 py-1 text-center text-xs font-bold text-foreground'));
    return inherited.render;
  },
});
export { calendarWeekday as bootstrap232CalendarWeekday };

export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'bootstrap-2-3-2-calendar-row',
  setup(def) {
    asCalendarRow();
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return (render) => render.slot();
  },
});
export { calendarRow as bootstrap232CalendarRow };

export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'bootstrap-2-3-2-calendar-day',
  setup(def) {
    const inherited = asCalendarDay();
    const state = inherited.stateHandles;
    if (!state) throw new Error('Calendar day state unavailable');
    def.feedback.style.use(
      tw(
        'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-transparent bg-transparent p-0 text-center text-sm font-normal leading-5 text-foreground select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-[#f5f5f5]')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-muted shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]')
        ),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(
            'bg-[linear-gradient(#08c,#04c)] text-primary-foreground border-primary shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
          )
        ),
    });
    def.rule({
      when: (w) => w.all(w.state(state.today).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-muted border-border')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.outside).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default')),
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
export { calendarDay as bootstrap232CalendarDay };

export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'bootstrap-2-3-2-calendar-heading',
  setup(def) {
    const state = asCalendarHeading().stateHandles;
    if (!state) throw new Error('Calendar heading state unavailable');
    def.feedback.style.use(tw('min-w-0 flex-1 text-center text-sm font-bold leading-5'));
    return () => [state.displayValue.get()];
  },
});
export { calendarHeading as bootstrap232CalendarHeading };

export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'bootstrap-2-3-2-calendar-previous',
  setup(def) {
    const state = asCalendarPrevious().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-[linear-gradient(#fff,#e6e6e6)] p-0 text-sm font-normal leading-5 text-foreground select-none cursor-pointer shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-[#e6e6e6]')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#e6e6e6] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]')
        ),
    });
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
      intent: (i) => i.feedback.style.use(tw('bg-[#e6e6e6] opacity-65 cursor-default shadow-none')),
    });
    return (render) => render.slot();
  },
});
export { calendarPrevious as bootstrap232CalendarPrevious };

export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'bootstrap-2-3-2-calendar-next',
  setup(def) {
    const state = asCalendarNext().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] border border-border bg-[linear-gradient(#fff,#e6e6e6)] p-0 text-sm font-normal leading-5 text-foreground select-none cursor-pointer shadow-[inset_0_1px_0_rgb(255_255_255/20%),0_1px_2px_rgb(0_0_0/5%)]'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-[#e6e6e6]')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-[#e6e6e6] shadow-[inset_0_2px_4px_rgb(0_0_0/15%),0_1px_2px_rgb(0_0_0/5%)]')
        ),
    });
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
      intent: (i) => i.feedback.style.use(tw('bg-[#e6e6e6] opacity-65 cursor-default shadow-none')),
    });
    return (render) => render.slot();
  },
});
export { calendarNext as bootstrap232CalendarNext };
