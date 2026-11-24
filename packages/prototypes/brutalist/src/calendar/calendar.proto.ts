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
import { BRUTALIST_DISABLED_TOKENS, BRUTALIST_FOCUS_TOKENS } from '../style';
export type * from '@proto.ui/prototypes-base/calendar';

// Visual recipe: neobrutalism-components Calendar at 3306a802.
// The root has a hard 4px adaptive shadow; day and navigation controls use noShadow geometry.
// Upstream font-base maps to the family sans/medium pair; see THIRD_PARTY_NOTICES.md.

export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'brutalist-calendar-root',
  modules: asCalendarRoot.modules,
  setup(def) {
    const behavior = asCalendarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Calendar root state unavailable');
    def.feedback.style.use(
      tw(
        'inline-grid w-fit min-w-0 max-w-full gap-4 rounded-base border-2 border-border bg-background p-3 font-heading font-bold text-foreground shadow-[4px_4px_0_0_var(--pui-foreground)]'
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
    return behavior.render;
  },
});
export { calendarRoot as brutalistCalendarRoot };

export const calendarCaption = definePrototype<CalendarCaptionProps, CalendarCaptionExposes>({
  name: 'brutalist-calendar-caption',
  modules: asCalendarCaption.modules,
  setup(def) {
    const behavior = asCalendarCaption();
    def.feedback.style.use(tw('flex min-h-7 w-full items-center justify-between gap-1'));
    return behavior.render;
  },
});
export { calendarCaption as brutalistCalendarCaption };

export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'brutalist-calendar-grid',
  modules: asCalendarGrid.modules,
  setup(def) {
    const behavior = asCalendarGrid();
    def.feedback.style.use(tw('grid w-full'));
    return behavior.render;
  },
});
export { calendarGrid as brutalistCalendarGrid };

export const calendarWeekdays = definePrototype<CalendarWeekdaysProps, CalendarWeekdaysExposes>({
  name: 'brutalist-calendar-weekdays',
  modules: asCalendarWeekdays.modules,
  setup(def) {
    const behavior = asCalendarWeekdays();
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return behavior.render;
  },
});
export { calendarWeekdays as brutalistCalendarWeekdays };

export const calendarWeekday = definePrototype<CalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'brutalist-calendar-weekday',
  modules: asCalendarWeekday.modules,
  setup(def) {
    const behavior = asCalendarWeekday();
    def.feedback.style.use(
      tw(
        'w-9 rounded-base text-center text-[0.8rem] font-sans font-medium text-foreground select-none'
      )
    );
    return behavior.render;
  },
});
export { calendarWeekday as brutalistCalendarWeekday };

export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'brutalist-calendar-row',
  modules: asCalendarRow.modules,
  setup(def) {
    const behavior = asCalendarRow();
    def.feedback.style.use(tw('mt-2 grid w-full grid-cols-7'));
    return behavior.render;
  },
});
export { calendarRow as brutalistCalendarRow };

export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'brutalist-calendar-day',
  modules: asCalendarDay.modules,
  setup(def) {
    const behavior = asCalendarDay();
    const state = behavior.stateHandles;
    if (!state) throw new Error('Calendar day state unavailable');
    def.feedback.style.use(
      tw(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-base border-2 p-0 text-center text-sm font-sans font-medium select-none cursor-pointer'
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
      intent: (i) => i.feedback.style.use(tw('border-transparent bg-transparent text-foreground')),
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
        i.feedback.style.use(tw('border-border bg-secondary-background font-bold text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('border-border bg-main/20 text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.pressed).eq(true),
          w.state(state.disabled).eq(false),
          w.state(state.selected).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('border-border bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.selected).eq(true), w.state(state.rangeMiddle).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('border-border bg-main text-main-foreground font-bold')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.rangeStart).eq(true),
          w.state(state.rangeEnd).eq(false),
          w.state(state.rangePending).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('rounded-none rounded-l-[5px]')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.rangeEnd).eq(true), w.state(state.rangeStart).eq(false)),
      intent: (i) => i.feedback.style.use(tw('rounded-none rounded-r-[5px]')),
    });
    def.rule({
      when: (w) => w.state(state.rangeMiddle).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('rounded-none border-transparent bg-main/25 text-foreground')),
    });
    def.rule({
      when: (w) => w.state(state.rangePending).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('ring-2 ring-ring ring-offset-2 ring-offset-background')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.outside).eq(true), w.state(state.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS, 'cursor-default')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('z-10', BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { calendarDay as brutalistCalendarDay };

export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'brutalist-calendar-heading',
  modules: asCalendarHeading.modules,
  setup(def) {
    const behavior = asCalendarHeading();
    def.feedback.style.use(
      tw('min-w-0 flex-1 text-center text-sm font-heading font-bold select-none')
    );
    return behavior.render;
  },
});
export { calendarHeading as brutalistCalendarHeading };

export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'brutalist-calendar-previous',
  modules: asCalendarPrevious.modules,
  setup(def) {
    const behavior = asCalendarPrevious();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-base border-2 border-border p-0 text-sm font-sans font-medium select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) =>
        w.any(
          w.state(state.disabled).eq(true),
          w.all(w.state(state.hovered).eq(false), w.state(state.pressed).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground translate-y-px')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS, 'cursor-default')),
    });
    return behavior.render;
  },
});
export { calendarPrevious as brutalistCalendarPrevious };

export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'brutalist-calendar-next',
  modules: asCalendarNext.modules,
  setup(def) {
    const behavior = asCalendarNext();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('Calendar navigation state unavailable');
    def.feedback.style.use(
      tw(
        'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-base border-2 border-border p-0 text-sm font-sans font-medium select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) =>
        w.any(
          w.state(state.disabled).eq(true),
          w.all(w.state(state.hovered).eq(false), w.state(state.pressed).eq(false))
        ),
      intent: (i) => i.feedback.style.use(tw('bg-secondary-background text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.hovered).eq(true),
          w.state(state.pressed).eq(false),
          w.state(state.disabled).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-main text-main-foreground translate-y-px')),
    });
    def.rule({
      when: (w) => w.state(state.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS, 'cursor-default')),
    });
    return behavior.render;
  },
});
export { calendarNext as brutalistCalendarNext };
