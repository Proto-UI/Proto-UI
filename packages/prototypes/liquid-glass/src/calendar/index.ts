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

// Apple-inspired composition, not a public Apple Calendar implementation.
// Material intent is an enhancement; the rounded opaque surface is a complete
// fallback and does not establish optical/material acceptance.

export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'liquid-glass-calendar-root',
  setup(def) {
    const state = asCalendarRoot().stateHandles;
    if (!state) throw new Error('Calendar root state unavailable');
    def.feedback.style.use(
      tw(
        'inline-grid w-fit min-w-0 max-w-full gap-3 rounded-2xl border border-border bg-secondary p-4 font-sans text-secondary-foreground shadow-lg'
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
    def.feedback.material.declare({
      version: 2,
      shape: { kind: 'rounded-rect', geometry: 'style' },
      source: { kind: 'in-app-backdrop' },
      fallback: { fill: 'style', foreground: 'style' },
    });
    def.feedback.material.use({ intent: 'liquid-glass' });
    return (render) => render.slot();
  },
});
export { calendarRoot as liquidGlassCalendarRoot };

export const calendarCaption = definePrototype<CalendarCaptionProps, CalendarCaptionExposes>({
  name: 'liquid-glass-calendar-caption',
  setup(def) {
    asCalendarCaption();
    def.feedback.style.use(tw('flex h-9 w-full items-center justify-between gap-2'));
    return (render) => render.slot();
  },
});
export { calendarCaption as liquidGlassCalendarCaption };

export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'liquid-glass-calendar-grid',
  setup(def) {
    asCalendarGrid();
    def.feedback.style.use(tw('grid w-full gap-1'));
    return (render) => render.slot();
  },
});
export { calendarGrid as liquidGlassCalendarGrid };

export const calendarWeekdays = definePrototype<CalendarWeekdaysProps, CalendarWeekdaysExposes>({
  name: 'liquid-glass-calendar-weekdays',
  setup(def) {
    asCalendarWeekdays();
    def.feedback.style.use(tw('grid w-full grid-cols-7 gap-1'));
    return (render) => render.slot();
  },
});
export { calendarWeekdays as liquidGlassCalendarWeekdays };

export const calendarWeekday = definePrototype<CalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'liquid-glass-calendar-weekday',
  setup(def) {
    const inherited = asCalendarWeekday();
    def.feedback.style.use(
      tw('w-9 py-1 text-center text-xs font-semibold text-muted-foreground select-none')
    );
    return inherited.render;
  },
});
export { calendarWeekday as liquidGlassCalendarWeekday };

export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'liquid-glass-calendar-row',
  setup(def) {
    asCalendarRow();
    def.feedback.style.use(tw('grid w-full grid-cols-7 gap-1'));
    return (render) => render.slot();
  },
});
export { calendarRow as liquidGlassCalendarRow };

export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'liquid-glass-calendar-day',
  setup(def) {
    const inherited = asCalendarDay();
    const state = inherited.stateHandles;
    if (!state) throw new Error('Calendar day state unavailable');
    def.feedback.style.use(
      tw(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0 text-center text-sm font-medium text-secondary-foreground select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-background shadow-xs')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-background shadow-none')),
    });
    def.rule({
      when: (w) => w.state(state.selected).eq(true),
      intent: (i) => i.feedback.style.use(tw('bg-primary text-primary-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.today).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-background text-primary')),
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
export { calendarDay as liquidGlassCalendarDay };

export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'liquid-glass-calendar-heading',
  setup(def) {
    const state = asCalendarHeading().stateHandles;
    if (!state) throw new Error('Calendar heading state unavailable');
    def.feedback.style.use(tw('min-w-0 flex-1 text-center text-sm font-semibold tracking-tight'));
    return () => [state.displayValue.get()];
  },
});
export { calendarHeading as liquidGlassCalendarHeading };

export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'liquid-glass-calendar-previous',
  setup(def) {
    const state = asCalendarPrevious().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background p-0 text-sm font-medium text-primary select-none cursor-pointer shadow-xs'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-none')),
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
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return (render) => render.slot();
  },
});
export { calendarPrevious as liquidGlassCalendarPrevious };

export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'liquid-glass-calendar-next',
  setup(def) {
    const state = asCalendarNext().getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-background p-0 text-sm font-medium text-primary select-none cursor-pointer shadow-xs'
      )
    );
    def.rule({
      when: (w) => w.all(w.state(state.hovered).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-sm')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('shadow-none')),
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
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default')),
    });
    return (render) => render.slot();
  },
});
export { calendarNext as liquidGlassCalendarNext };
