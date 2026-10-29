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
  type CalendarRootProps,
  type CalendarRootExposes,
  type CalendarCaptionProps,
  type CalendarCaptionExposes,
  type CalendarGridExposes,
  type CalendarWeekdaysExposes,
  type CalendarWeekdayProps,
  type CalendarWeekdayExposes,
  type CalendarRowProps,
  type CalendarRowExposes,
  type CalendarDayProps,
  type CalendarDayExposes,
  type CalendarHeadingExposes,
  type CalendarPreviousProps,
  type CalendarPreviousExposes,
  type CalendarNextProps,
  type CalendarNextExposes,
} from '@proto.ui/prototypes-base/calendar';
import {
  SHADCN_STYLE_IDS,
  setupShadcnStyleScope,
  setupShadcnStyleSelection,
  type ShadcnStyleProps,
} from '../style-scope';
import { setupCollectionActionVisual } from '../toolbar/action-visual';
import {
  CALENDAR_ROOT_PROFILE,
  CALENDAR_CELL_SIZE,
  CALENDAR_CELL_RADIUS,
  CALENDAR_CAPTION_SIZE,
  setupCalendarDayVisual,
} from './visual';
export type * from '@proto.ui/prototypes-base/calendar';
export type ShadcnCalendarRootProps = CalendarRootProps & ShadcnStyleProps;
export type ShadcnCalendarCaptionProps = CalendarCaptionProps & ShadcnStyleProps;
export type ShadcnCalendarGridProps = ShadcnStyleProps;
export type ShadcnCalendarWeekdaysProps = ShadcnStyleProps;
export type ShadcnCalendarWeekdayProps = CalendarWeekdayProps & ShadcnStyleProps;
export type ShadcnCalendarRowProps = CalendarRowProps & ShadcnStyleProps;
export type ShadcnCalendarDayProps = CalendarDayProps & ShadcnStyleProps;
export type ShadcnCalendarHeadingProps = ShadcnStyleProps;
export type ShadcnCalendarPreviousProps = CalendarPreviousProps & ShadcnStyleProps;
export type ShadcnCalendarNextProps = CalendarNextProps & ShadcnStyleProps;

export const calendarRoot = definePrototype<ShadcnCalendarRootProps, CalendarRootExposes>({
  name: 'shadcn-calendar-root',
  setup(def) {
    const behavior = asCalendarRoot();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-calendar] Root state unavailable.');
    setupShadcnStyleScope(def);
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(
      tw('inline-grid w-fit min-w-0 max-w-full gap-4 bg-background text-foreground')
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(CALENDAR_ROOT_PROFILE[profile])),
      });
    }
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
export { calendarRoot as shadcnCalendarRoot };

export const calendarCaption = definePrototype<ShadcnCalendarCaptionProps, CalendarCaptionExposes>({
  name: 'shadcn-calendar-caption',
  setup(def) {
    const behavior = asCalendarCaption();
    const style = setupShadcnStyleSelection(def, 'nova');
    // Base caption composes previous/heading/next instead of the source's
    // absolutely positioned nav sibling. This is the public Proto anatomy.
    def.feedback.style.use(tw('flex w-full items-center justify-between gap-1'));
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(CALENDAR_CAPTION_SIZE[profile])),
      });
    }
    return behavior.render;
  },
});
export { calendarCaption as shadcnCalendarCaption };

export const calendarGrid = definePrototype<ShadcnCalendarGridProps, CalendarGridExposes>({
  name: 'shadcn-calendar-grid',
  setup(def) {
    const behavior = asCalendarGrid();
    setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('grid w-full'));
    return behavior.render;
  },
});
export { calendarGrid as shadcnCalendarGrid };

export const calendarWeekdays = definePrototype<
  ShadcnCalendarWeekdaysProps,
  CalendarWeekdaysExposes
>({
  name: 'shadcn-calendar-weekdays',
  setup(def) {
    const behavior = asCalendarWeekdays();
    setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('grid w-full grid-cols-7'));
    return behavior.render;
  },
});
export { calendarWeekdays as shadcnCalendarWeekdays };

export const calendarWeekday = definePrototype<ShadcnCalendarWeekdayProps, CalendarWeekdayExposes>({
  name: 'shadcn-calendar-weekday',
  setup(def) {
    const behavior = asCalendarWeekday();
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(
      tw('flex-1 text-center text-[0.8rem] font-normal text-muted-foreground select-none')
    );
    for (const profile of SHADCN_STYLE_IDS) {
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(CALENDAR_CELL_SIZE[profile])),
      });
      def.rule({
        when: (w) => w.state(style).eq(profile),
        intent: (i) => i.feedback.style.use(tw(CALENDAR_CELL_RADIUS[profile])),
      });
    }
    return behavior.render;
  },
});
export { calendarWeekday as shadcnCalendarWeekday };

export const calendarRow = definePrototype<ShadcnCalendarRowProps, CalendarRowExposes>({
  name: 'shadcn-calendar-row',
  setup(def) {
    const behavior = asCalendarRow();
    setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('mt-2 grid w-full grid-cols-7'));
    return behavior.render;
  },
});
export { calendarRow as shadcnCalendarRow };

export const calendarDay = definePrototype<ShadcnCalendarDayProps, CalendarDayExposes>({
  name: 'shadcn-calendar-day',
  setup(def) {
    const behavior = asCalendarDay();
    const state = behavior.stateHandles;
    if (!state) throw new Error('[shadcn-calendar] Day state unavailable.');
    setupCalendarDayVisual(def, state);
    return behavior.render;
  },
});
export { calendarDay as shadcnCalendarDay };

export const calendarHeading = definePrototype<ShadcnCalendarHeadingProps, CalendarHeadingExposes>({
  name: 'shadcn-calendar-heading',
  setup(def) {
    const behavior = asCalendarHeading();
    const style = setupShadcnStyleSelection(def, 'nova');
    def.feedback.style.use(tw('min-w-0 flex-1 text-center font-medium select-none'));
    def.rule({
      when: (w) => w.not(w.state(style).eq('sera')),
      intent: (i) => i.feedback.style.use(tw('text-sm')),
    });
    def.rule({
      when: (w) => w.state(style).eq('sera'),
      intent: (i) => i.feedback.style.use(tw('text-xs font-semibold uppercase tracking-wide')),
    });
    return behavior.render;
  },
});
export { calendarHeading as shadcnCalendarHeading };

export const calendarPrevious = definePrototype<
  ShadcnCalendarPreviousProps,
  CalendarPreviousExposes
>({
  name: 'shadcn-calendar-previous',
  setup(def) {
    const behavior = asCalendarPrevious();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('[shadcn-calendar] Navigation state unavailable.');
    setupCollectionActionVisual(def, state, 'ghost', true);
    return behavior.render;
  },
});
export { calendarPrevious as shadcnCalendarPrevious };

export const calendarNext = definePrototype<ShadcnCalendarNextProps, CalendarNextExposes>({
  name: 'shadcn-calendar-next',
  setup(def) {
    const behavior = asCalendarNext();
    const state = behavior.getAsHookHandle?.('as-button')?.stateHandles;
    if (!state) throw new Error('[shadcn-calendar] Navigation state unavailable.');
    setupCollectionActionVisual(def, state, 'ghost', true);
    return behavior.render;
  },
});
export { calendarNext as shadcnCalendarNext };
