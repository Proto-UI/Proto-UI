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
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonRaised,
  bootstrapButtonPressed,
} from '../button/paint';
import { applyBootstrapCalendarDayPaint } from '../calendar/day-paint';
export type * from '@proto.ui/prototypes-base/date-picker';

// DatePicker is a Proto extension, not an official Bootstrap 2.3.2 widget.
// Its single Base hook composes Calendar selection and Popover open ownership.
export const datePickerRoot = definePrototype<DatePickerRootProps, DatePickerRootExposes>({
  name: 'bootstrap-2-3-2-date-picker-root',
  modules: asDatePickerRoot.modules,
  setup(def) {
    const behavior = asDatePickerRoot();
    const state = behavior.getAsHookHandle?.('as-calendar-root')?.stateHandles;
    if (!state)
      throw new Error(
        '[bootstrap-2-3-2-date-picker] Required inherited Calendar states unavailable.'
      );
    def.feedback.style.use(
      tw('min-w-0 max-w-full font-sans text-[14px] leading-[20px] text-foreground')
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
export { datePickerRoot as bootstrap232DatePickerRoot };

export const datePickerTrigger = definePrototype<DatePickerTriggerProps, DatePickerTriggerExposes>({
  name: 'bootstrap-2-3-2-date-picker-trigger',
  modules: asDatePickerTrigger.modules,
  setup(def) {
    const behavior = asDatePickerTrigger();
    const state = behavior.getAsHookHandle?.('as-popover-trigger')?.stateHandles;
    if (!state)
      throw new Error(
        '[bootstrap-2-3-2-date-picker] Required inherited Popover command states unavailable.'
      );
    def.feedback.style.use(
      tw(
        'inline-flex shrink-0 items-center justify-center rounded-[4px] border px-[12px] py-[4px] text-[14px] font-normal leading-[20px] select-none cursor-pointer min-w-0 max-w-full whitespace-normal wrap-anywhere text-paint-[#333_0_1px_1px_rgb(255_255_255/75%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_#b3b3b3_rgb(0_0_0/10%)]'
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
        i.feedback.style.use(tw('outline-none ring-2 ring-ring forced-colors-focus-outline')),
    });
    def.rule({
      when: (w) => w.state(state.disabled).eq(true),
      intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default shadow-none')),
    });
    return behavior.render;
  },
});
export { datePickerTrigger as bootstrap232DatePickerTrigger };

export const datePickerContent = definePrototype<DatePickerContentProps, DatePickerContentExposes>({
  name: 'bootstrap-2-3-2-date-picker-content',
  modules: asDatePickerContent.modules,
  setup(def) {
    const behavior = asDatePickerContent();
    const popover = behavior.getAsHookHandle?.('as-popover-content');
    if (!popover)
      throw new Error(
        '[bootstrap-2-3-2-date-picker] Required inherited Popover Content handle unavailable.'
      );
    def.props.setDefaults({ sideOffset: 10 });
    def.feedback.style.use(
      tw(
        'rounded-[6px] border border-[rgb(0_0_0/20%)] bg-background bg-clip-padding text-foreground font-sans text-[14px] leading-[20px] shadow-[0_5px_10px_rgb(0_0_0/20%)] p-[1px] max-w-[min(276px,var(--proto-ui-available-width))] max-h-[var(--proto-ui-available-height)] overflow-y-auto text-left whitespace-normal'
      )
    );
    popover.asTransition.configure({ enterDuration: 150, leaveDuration: 150 });
    def.feedback.style.presence({
      owner: popover.asTransition.presentationOwner,
      closed: { opacity: 0 },
      entered: { opacity: 1 },
      easing: [0, 0, 1, 1],
    });
    // Base Content has no custom render result. This passive wrapper projects
    // .popover-content's separate 9px/14px inset, preserving its authored slot.
    return (renderer) => renderer.el('div', { style: tw('px-[14px] py-[9px]') }, renderer.r.slot());
  },
});
export { datePickerContent as bootstrap232DatePickerContent };

export const datePickerDay = definePrototype<DatePickerDayProps, DatePickerDayExposes>({
  name: 'bootstrap-2-3-2-date-picker-day',
  modules: asDatePickerDay.modules,
  setup(def) {
    const behavior = asDatePickerDay();
    const state = behavior.getAsHookHandle?.('as-calendar-day')?.stateHandles;
    if (!state)
      throw new Error(
        '[bootstrap-2-3-2-date-picker] Required inherited Calendar Day states unavailable.'
      );
    applyBootstrapCalendarDayPaint(def, state);
    return behavior.render;
  },
});
export { datePickerDay as bootstrap232DatePickerDay };

export const datePickerValue = definePrototype<DatePickerValueProps, DatePickerValueExposes>({
  name: 'bootstrap-2-3-2-date-picker-value',
  modules: asDatePickerValue.modules,
  setup(def) {
    const behavior = asDatePickerValue();
    def.feedback.style.use(tw('min-w-0 max-w-full text-[14px] leading-[20px] text-inherit'));
    return behavior.render;
  },
});
export { datePickerValue as bootstrap232DatePickerValue };
