import {
  BRUTALIST_CONTROL_TOKENS,
  BRUTALIST_PANEL_TOKENS,
  BRUTALIST_FOCUS_TOKENS,
  BRUTALIST_PRESS_TOKENS,
  BRUTALIST_DISABLED_TOKENS,
  BRUTALIST_MOTION_HIT_TOKENS,
} from '../style';
import type {
  DatePickerRootProps,
  DatePickerRootExposes,
  DatePickerTriggerProps,
  DatePickerTriggerExposes,
  DatePickerContentProps,
  DatePickerContentExposes,
  DatePickerDayProps,
  DatePickerDayExposes,
  DatePickerValueProps,
  DatePickerValueExposes,
} from '@proto.ui/prototypes-base/date-picker';
import { definePrototype, tw } from '@proto.ui/core';
import {
  asDatePickerRoot,
  asDatePickerTrigger,
  asDatePickerContent,
  asDatePickerDay,
  asDatePickerValue,
} from '@proto.ui/prototypes-base/date-picker';
export type * from '@proto.ui/prototypes-base/date-picker';

export const datePickerRoot = definePrototype<DatePickerRootProps, DatePickerRootExposes>({
  name: 'brutalist-date-picker-root',
  modules: asDatePickerRoot.modules,
  setup(def) {
    const behavior = asDatePickerRoot();
    const calendar = behavior.getAsHookHandle?.('as-calendar-root')?.stateHandles;
    if (!calendar)
      throw new Error('[brutalist-date-picker] Required inherited state is unavailable.');
    def.feedback.style.use(
      tw('inline-grid min-w-0 max-w-full gap-2 font-sans font-medium text-foreground')
    );
    def.rule({
      when: (w) => w.state(calendar.direction).eq('ltr'),
      intent: (i) => i.feedback.style.use(tw('direction-ltr')),
    });
    def.rule({
      when: (w) => w.state(calendar.direction).eq('rtl'),
      intent: (i) => i.feedback.style.use(tw('direction-rtl')),
    });
    return behavior.render;
  },
});
export { datePickerRoot as brutalistDatePickerRoot };

export const datePickerTrigger = definePrototype<DatePickerTriggerProps, DatePickerTriggerExposes>({
  name: 'brutalist-date-picker-trigger',
  modules: asDatePickerTrigger.modules,
  setup(def) {
    const behavior = asDatePickerTrigger();
    const states = behavior.getAsHookHandle?.('as-popover-trigger')?.stateHandles;
    if (!states)
      throw new Error('[brutalist-date-picker] Required inherited state is unavailable.');
    def.feedback.style.use(
      tw(
        BRUTALIST_CONTROL_TOKENS,
        'min-w-0 max-w-full inline-flex h-10 items-center justify-between gap-2 px-3 py-2 text-sm text-start cursor-pointer select-none'
      )
    );
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw(BRUTALIST_DISABLED_TOKENS, 'cursor-default shadow-none')),
    });
    // Raised control collapses its 4px resting shadow on press; no second interaction hook.
    def.rule({
      when: (w) => w.all(w.state(states.pressed).eq(true), w.state(states.disabled).eq(false)),
      intent: (i) => i.feedback.style.use(tw(BRUTALIST_PRESS_TOKENS, BRUTALIST_MOTION_HIT_TOKENS)),
    });
    return behavior.render;
  },
});
export { datePickerTrigger as brutalistDatePickerTrigger };

export const datePickerContent = definePrototype<DatePickerContentProps, DatePickerContentExposes>({
  name: 'brutalist-date-picker-content',
  modules: asDatePickerContent.modules,
  setup(def) {
    const behavior = asDatePickerContent();
    // Floating popup panel: 5px rounded-base, 2px black border, 3px foreground hard shadow.
    def.feedback.style.use(
      tw(
        BRUTALIST_PANEL_TOKENS,
        'z-50 grid w-auto min-w-0 max-w-[var(--proto-ui-available-width)] max-h-[var(--proto-ui-available-height)] overflow-y-auto gap-3 p-3 shadow-[3px_3px_0_0_var(--pui-foreground)] outline-none'
      )
    );
    return behavior.render;
  },
});
export { datePickerContent as brutalistDatePickerContent };

export const datePickerDay = definePrototype<DatePickerDayProps, DatePickerDayExposes>({
  name: 'brutalist-date-picker-day',
  modules: asDatePickerDay.modules,
  setup(def) {
    const behavior = asDatePickerDay();
    const states = behavior.getAsHookHandle?.('as-calendar-day')?.stateHandles;
    if (!states)
      throw new Error('[brutalist-date-picker] Required inherited state is unavailable.');
    // Flat grid day cell aligned with brutalist-calendar-day; no raised press translation.
    def.feedback.style.use(
      tw(
        'relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-base border-2 border-border bg-secondary-background p-0 text-center text-sm font-sans font-medium text-foreground select-none cursor-pointer'
      )
    );
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.hovered).eq(true),
          w.state(states.disabled).eq(false),
          w.state(states.selected).eq(false),
          w.state(states.rangeMiddle).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-main/20 text-foreground')),
    });
    def.rule({
      when: (w) =>
        w.all(
          w.state(states.rangePending).eq(true),
          w.state(states.disabled).eq(false),
          w.state(states.selected).eq(false),
          w.state(states.rangeMiddle).eq(false)
        ),
      intent: (i) => i.feedback.style.use(tw('bg-muted text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(states.selected).eq(true), w.state(states.rangeMiddle).eq(false)),
      intent: (i) =>
        i.feedback.style.use(tw('bg-main text-main-foreground font-heading font-bold')),
    });
    def.rule({
      when: (w) => w.state(states.rangeMiddle).eq(true),
      intent: (i) => i.feedback.style.use(tw('rounded-none bg-main/20 text-foreground')),
    });
    def.rule({
      when: (w) => w.all(w.state(states.today).eq(true), w.state(states.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('bg-transparent font-heading font-bold')),
    });
    def.rule({
      when: (w) => w.all(w.state(states.outside).eq(true), w.state(states.selected).eq(false)),
      intent: (i) => i.feedback.style.use(tw('opacity-50')),
    });
    def.rule({
      when: (w) => w.state(states.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-50 cursor-default pointer-events-none')),
    });
    def.rule({
      when: (w) => w.state(states.focusVisible).eq(true),
      intent: (i) =>
        i.feedback.style.use(tw('z-10', BRUTALIST_FOCUS_TOKENS, 'forced-colors-focus-outline')),
    });
    return behavior.render;
  },
});
export { datePickerDay as brutalistDatePickerDay };

export const datePickerValue = definePrototype<DatePickerValueProps, DatePickerValueExposes>({
  name: 'brutalist-date-picker-value',
  modules: asDatePickerValue.modules,
  setup(def) {
    const behavior = asDatePickerValue();
    def.feedback.style.use(
      tw('min-w-0 max-w-full font-sans font-medium text-sm text-start text-inherit')
    );
    return behavior.render;
  },
});
export { datePickerValue as brutalistDatePickerValue };
