import { tw, type AsHookBorrowedStates, type DefHandle } from '@proto.ui/core';
import type {
  CalendarDayContract,
  CalendarDayProps,
  CalendarDayExposes,
} from '@proto.ui/prototypes-base/calendar';
import {
  bootstrapButtonRestFill,
  bootstrapButtonInteractiveFill,
  bootstrapButtonFlatFill,
  bootstrapButtonPressedFill,
  bootstrapButtonPressed,
} from '../button/paint';

type DayStates = AsHookBorrowedStates<CalendarDayProps, CalendarDayContract['state']>;

// Calendar and DatePicker remain distinct Base owners. Only their passive day
// grammar is shared: condensed table copy and selected .btn-primary paint.
// Bootstrap 2.3.2 did not ship either modern component; the 30px minimum is
// this extension's 20px line + 8px padding + 2px border, not an upstream calendar.
export function applyBootstrapCalendarDayPaint(
  def: DefHandle<CalendarDayProps, CalendarDayExposes>,
  state: DayStates
): void {
  def.feedback.style.use(
    tw(
      'relative inline-flex min-w-[30px] shrink-0 items-center justify-center rounded-[4px] border px-[5px] py-[4px] text-center text-[14px] font-normal leading-[20px] select-none cursor-pointer'
    )
  );
  def.rule({
    when: (w) => w.state(state.selected).eq(false),
    intent: (i) => i.feedback.style.use(tw('border-transparent text-foreground')),
  });
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
        w.state(state.today).eq(true),
        w.any(
          w.state(state.disabled).eq(true),
          w.all(w.state(state.hovered).eq(false), w.state(state.pressed).eq(false))
        )
      ),
    intent: (i) => i.feedback.style.use(tw('bg-[#eee] border-border')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(false),
        w.state(state.disabled).eq(false),
        w.state(state.hovered).eq(true),
        w.state(state.pressed).eq(false)
      ),
    intent: (i) => i.feedback.style.use(tw('bg-[#f5f5f5]')),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(false),
        w.state(state.disabled).eq(false),
        w.state(state.pressed).eq(true)
      ),
    intent: (i) =>
      i.feedback.style.use(tw(bootstrapButtonFlatFill.default, bootstrapButtonPressed)),
  });
  def.rule({
    when: (w) => w.state(state.selected).eq(true),
    intent: (i) =>
      i.feedback.style.use(
        tw(
          'text-paint-[#fff_0_-1px_0_rgb(0_0_0/25%)] border-[rgb(0_0_0/10%)_rgb(0_0_0/10%)_rgb(0_0_0/25%)_rgb(0_0_0/10%)]'
        )
      ),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(true),
        w.state(state.disabled).eq(false),
        w.state(state.pressed).eq(false),
        w.state(state.hovered).eq(false),
        w.not(w.state(state.focused).eq(true))
      ),
    intent: (i) => i.feedback.style.use(tw(bootstrapButtonRestFill.primary)),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(true),
        w.state(state.disabled).eq(false),
        w.state(state.pressed).eq(false),
        w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
      ),
    intent: (i) => i.feedback.style.use(tw(bootstrapButtonInteractiveFill.primary)),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(true),
        w.any(
          w.state(state.disabled).eq(true),
          w.all(
            w.state(state.pressed).eq(true),
            w.state(state.hovered).eq(false),
            w.not(w.state(state.focused).eq(true))
          )
        )
      ),
    intent: (i) => i.feedback.style.use(tw(bootstrapButtonFlatFill.primary)),
  });
  def.rule({
    when: (w) =>
      w.all(
        w.state(state.selected).eq(true),
        w.state(state.disabled).eq(false),
        w.state(state.pressed).eq(true),
        w.any(w.state(state.hovered).eq(true), w.state(state.focused).eq(true))
      ),
    intent: (i) =>
      i.feedback.style.use(tw(bootstrapButtonPressedFill.primary, bootstrapButtonPressed)),
  });
  def.rule({
    when: (w) => w.all(w.state(state.outside).eq(true), w.state(state.selected).eq(false)),
    intent: (i) => i.feedback.style.use(tw('text-[#999]')),
  });
  def.rule({
    when: (w) => w.state(state.disabled).eq(true),
    intent: (i) => i.feedback.style.use(tw('opacity-65 cursor-default shadow-none')),
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
}
