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
import { COMMAND_DISABLED, COMMAND_FOCUS } from '../interactive-surface';
export type * from '@proto.ui/prototypes-base/calendar';

// Apple-inspired composition, not a public Apple Calendar implementation.
// Calendar is ordinary date content. A containing DatePicker popup, when used,
// owns its own single material surface; these parts do not create nested glass.

export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'liquid-glass-calendar-root',
  modules: asCalendarRoot.modules,
  setup(def) {
    const behavior = asCalendarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Calendar root state unavailable');
    def.feedback.style.use(
      tw(
        'inline-grid w-fit min-w-0 max-w-full gap-3 rounded-2xl border border-border/70 p-3 font-sans text-foreground shadow-md ring-1 ring-inset ring-foreground/10'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.meta('preference.reducedTransparency').eq('no-preference'),
          w.meta('preference.forcedColors').eq('none')
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary/90')),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.not(w.meta('preference.reducedTransparency').eq('no-preference')),
          w.not(w.meta('preference.forcedColors').eq('none'))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary')),
    });
    def.rule({
      when: (w) => w.state(state.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('direction-ltr')),
    });
    def.rule({
      when: (w) => w.state(state.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    return behavior.render;
  },
});
export { calendarRoot as liquidGlassCalendarRoot };

export const calendarCaption = definePrototype<CalendarCaptionProps, CalendarCaptionExposes>({
  name: 'liquid-glass-calendar-caption',
  modules: asCalendarCaption.modules,
  setup(def) {
    const behavior = asCalendarCaption();
    def.feedback.style.use(tw('flex h-9 w-full items-center justify-between gap-2'));
    return behavior.render;
  },
});
export { calendarCaption as liquidGlassCalendarCaption };

export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'liquid-glass-calendar-grid',
  modules: asCalendarGrid.modules,
  setup(def) {
    const behavior = asCalendarGrid();
    def.feedback.style.use(tw('grid w-full gap-1'));
    return behavior.render;
  },
});
export { calendarGrid as liquidGlassCalendarGrid };

export const calendarWeekdays = definePrototype<CalendarWeekdaysProps, CalendarWeekdaysExposes>({
  name: 'liquid-glass-calendar-weekdays',
  modules: asCalendarWeekdays.modules,
  setup(def) {
    const behavior = asCalendarWeekdays();
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return behavior.render;
  },
});
export { calendarWeekdays as liquidGlassCalendarWeekdays };

export const calendarWeekday = definePrototype<CalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'liquid-glass-calendar-weekday',
  modules: asCalendarWeekday.modules,
  setup(def) {
    const behavior = asCalendarWeekday();
    def.feedback.style.use(
      tw('w-9 py-1 text-center text-xs font-semibold text-muted-foreground select-none')
    );
    return behavior.render;
  },
});
export { calendarWeekday as liquidGlassCalendarWeekday };

export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'liquid-glass-calendar-row',
  modules: asCalendarRow.modules,
  setup(def) {
    const behavior = asCalendarRow();
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return behavior.render;
  },
});
export { calendarRow as liquidGlassCalendarRow };

export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'liquid-glass-calendar-day',
  modules: asCalendarDay.modules,
  setup(def) {
    const behavior = asCalendarDay();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Calendar day state unavailable');
    def.feedback.style.use(
      tw(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-0 p-0 text-center text-sm font-medium select-none cursor-pointer transition-all'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.selected).eq(false),
          w.state(state.today).eq(false),
          w.any(
            w.state(state.disabled).eq(true),
            w.all(w.state(state.hovered).eq(false), w.state(state.pressed).eq(false))
          )
        ),
      intent: (i) => i.feedback.style.use(tw('bg-transparent')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.selected).eq(false),
          w.state(state.today).eq(false),
          w.state(state.outside).eq(false),
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.today).eq(true),
          w.state(state.selected).eq(false),
          w.any(
            w.state(state.disabled).eq(true),
            w.all(w.state(state.hovered).eq(false), w.state(state.pressed).eq(false))
          )
        ),
      intent: (i) =>
        i.feedback.style.use(
          tw('bg-primary/10 text-primary font-semibold ring-1 ring-inset ring-primary/30')
        ),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-primary/15 text-primary')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.selected).eq(true), w.state(state.rangeMiddle).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('bg-primary text-primary-foreground font-semibold shadow-xs')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.rangeStart).eq(true),
          w.state(state.rangeEnd).eq(false),
          w.state(state.rangePending).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-none rounded-l-xl')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.rangeEnd).eq(true), w.state(state.rangeStart).eq(false)),
      intent: (i) => i.feedback.style.use(tw('rounded-none rounded-r-xl')),
    });
    def.rule({
      when: (w) => w.state(state.rangeMiddle).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('rounded-none bg-primary/15 text-primary font-medium')),
    });
    def.rule({
      when: (w) => w.state(state.rangePending).eq(true),
      intent: (i) => i.feedback.style.use(tw('ring-2 ring-primary/40')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.outside).eq(true),
          w.state(state.selected).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('text-muted-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_DISABLED, 'text-muted-foreground/50')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw('z-10', COMMAND_FOCUS)),
    });
    return behavior.render;
  },
});
export { calendarDay as liquidGlassCalendarDay };

export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'liquid-glass-calendar-heading',
  modules: asCalendarHeading.modules,
  setup(def) {
    const behavior = asCalendarHeading();
    def.feedback.style.use(tw('min-w-0 flex-1 text-center text-sm font-semibold tracking-tight'));
    return behavior.render;
  },
});
export { calendarHeading as liquidGlassCalendarHeading };

export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'liquid-glass-calendar-previous',
  modules: asCalendarPrevious.modules,
  setup(def) {
    const behavior = asCalendarPrevious();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 p-0 text-sm font-medium select-none cursor-pointer shadow-xs transition-all'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.hovered).eq(false),
          w.state(state.pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-background text-primary')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-muted text-primary shadow-sm ring-1 ring-inset ring-border')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-primary/15 text-primary shadow-none')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(COMMAND_DISABLED, 'bg-muted/60 text-muted-foreground/50 border-border/50')
        ),
    });
    return behavior.render;
  },
});
export { calendarPrevious as liquidGlassCalendarPrevious };

export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'liquid-glass-calendar-next',
  modules: asCalendarNext.modules,
  setup(def) {
    const behavior = asCalendarNext();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/70 p-0 text-sm font-medium select-none cursor-pointer shadow-xs transition-all'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.hovered).eq(false),
          w.state(state.pressed).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-background text-primary')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) =>
        i.feedback.style.use(tw('bg-muted text-primary shadow-sm ring-1 ring-inset ring-border')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-primary/15 text-primary shadow-none')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) => i.feedback.style.use(tw(COMMAND_FOCUS)),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(
          tw(COMMAND_DISABLED, 'bg-muted/60 text-muted-foreground/50 border-border/50')
        ),
    });
    return behavior.render;
  },
});
export { calendarNext as liquidGlassCalendarNext };
