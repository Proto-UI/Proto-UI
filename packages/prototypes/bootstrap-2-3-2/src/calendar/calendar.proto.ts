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
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
import { applyBootstrapCalendarDayPaint } from './day-paint';
export type * from '@proto.ui/prototypes-base/calendar';

// Bootstrap 2.3.2 did not ship Calendar. This Proto extension uses historical
// button/table copy and px units, not a fictional official Calendar recipe.
// Every public Base owner and its renderer remain distinct and unchanged.
export const calendarRoot = definePrototype<CalendarRootProps, CalendarRootExposes>({
  name: 'bootstrap-2-3-2-calendar-root',
  modules: asCalendarRoot.modules,
  setup(def) {
    const behavior = asCalendarRoot();
    const state = behavior.stateHandles!;
    def.feedback.style.use(
      tw(
        'inline-grid w-fit min-w-0 max-w-full gap-[5px] font-sans text-[14px] leading-[20px] text-foreground'
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
export { calendarRoot as bootstrap232CalendarRoot };

export const calendarCaption = definePrototype<CalendarCaptionProps, CalendarCaptionExposes>({
  name: 'bootstrap-2-3-2-calendar-caption',
  modules: asCalendarCaption.modules,
  setup(def) {
    const behavior = asCalendarCaption();
    def.feedback.style.use(tw('flex w-full items-center justify-between gap-[5px]'));
    return behavior.render;
  },
});
export { calendarCaption as bootstrap232CalendarCaption };

export const calendarGrid = definePrototype<CalendarGridProps, CalendarGridExposes>({
  name: 'bootstrap-2-3-2-calendar-grid',
  modules: asCalendarGrid.modules,
  setup(def) {
    const behavior = asCalendarGrid();
    def.feedback.style.use(tw('grid w-full'));
    return behavior.render;
  },
});
export { calendarGrid as bootstrap232CalendarGrid };

export const calendarWeekdays = definePrototype<CalendarWeekdaysProps, CalendarWeekdaysExposes>({
  name: 'bootstrap-2-3-2-calendar-weekdays',
  modules: asCalendarWeekdays.modules,
  setup(def) {
    const behavior = asCalendarWeekdays();
    def.feedback.style.use(tw('grid w-full grid-cols-7 border-b border-[#ddd]'));
    return behavior.render;
  },
});
export { calendarWeekdays as bootstrap232CalendarWeekdays };

export const calendarWeekday = definePrototype<CalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'bootstrap-2-3-2-calendar-weekday',
  modules: asCalendarWeekday.modules,
  setup(def) {
    const behavior = asCalendarWeekday();
    def.feedback.style.use(
      tw(
        'min-w-[30px] px-[5px] py-[4px] text-center text-[14px] font-bold leading-[20px] text-foreground'
      )
    );
    return behavior.render;
  },
});
export { calendarWeekday as bootstrap232CalendarWeekday };

export const calendarRow = definePrototype<CalendarRowProps, CalendarRowExposes>({
  name: 'bootstrap-2-3-2-calendar-row',
  modules: asCalendarRow.modules,
  setup(def) {
    const behavior = asCalendarRow();
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return behavior.render;
  },
});
export { calendarRow as bootstrap232CalendarRow };

export const calendarDay = definePrototype<CalendarDayProps, CalendarDayExposes>({
  name: 'bootstrap-2-3-2-calendar-day',
  modules: asCalendarDay.modules,
  setup(def) {
    const behavior = asCalendarDay();
    const state = behavior.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-calendar] Required inherited Day states unavailable.');
    applyBootstrapCalendarDayPaint(def, state);
    return behavior.render;
  },
});
export { calendarDay as bootstrap232CalendarDay };

export const calendarHeading = definePrototype<CalendarHeadingProps, CalendarHeadingExposes>({
  name: 'bootstrap-2-3-2-calendar-heading',
  modules: asCalendarHeading.modules,
  setup(def) {
    const behavior = asCalendarHeading();
    def.feedback.style.use(tw('min-w-0 flex-1 text-center text-[14px] font-bold leading-[20px]'));
    return behavior.render;
  },
});
export { calendarHeading as bootstrap232CalendarHeading };

export const calendarPrevious = definePrototype<CalendarPreviousProps, CalendarPreviousExposes>({
  name: 'bootstrap-2-3-2-calendar-previous',
  modules: asCalendarPrevious.modules,
  setup(def) {
    const behavior = asCalendarPrevious();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-calendar] Required inherited Button states unavailable.');
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] select-none cursor-pointer text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.state(state.hovered).eq(false),
          w.not(w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(state.disabled).eq(true),
          w.all(
            w.state(state.pressed).eq(true),
            w.state(state.hovered).eq(false),
            w.not(w.state(state.focused).eq(true))
          )
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.default)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
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
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default shadow-none')),
    });
    return behavior.render;
  },
});
export { calendarPrevious as bootstrap232CalendarPrevious };

export const calendarNext = definePrototype<CalendarNextProps, CalendarNextExposes>({
  name: 'bootstrap-2-3-2-calendar-next',
  modules: asCalendarNext.modules,
  setup(def) {
    const behavior = asCalendarNext();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state)
      throw new Error('[bootstrap-2-3-2-calendar] Required inherited Button states unavailable.');
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] select-none cursor-pointer text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
      )
    );
    def.feedback.style.use(tw(bootstrapButtonRaised));
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.state(state.hovered).eq(false),
          w.not(w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(false),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.default)),
    });
    def.rule({
      when: (w) =>
        w.any(
          w.state(state.disabled).eq(true),
          w.all(
            w.state(state.pressed).eq(true),
            w.state(state.hovered).eq(false),
            w.not(w.state(state.focused).eq(true))
          )
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.default)),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(state.disabled).eq(false),
          w.state(state.pressed).eq(true),
          w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
        ),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressedFill.default)),
    });
    def.rule({
      when: (w) => w.all(w.state(state.pressed).eq(true), w.state(state.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(bootstrapButtonPressed)),
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
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default shadow-none')),
    });
    return behavior.render;
  },
});
export { calendarNext as bootstrap232CalendarNext };
