import type {
  DatePickerRootProps,
  DatePickerRootExposes,
  DatePickerRootAsHookContract,
  DatePickerTriggerProps,
  DatePickerTriggerExposes,
  DatePickerTriggerAsHookContract,
  DatePickerContentProps,
  DatePickerContentExposes,
  DatePickerContentAsHookContract,
  DatePickerDayProps,
  DatePickerDayExposes,
  DatePickerDayAsHookContract,
  DatePickerValueProps,
  DatePickerValueExposes,
  DatePickerValueAsHookContract,
} from './types';
export type * from './types';
import { defineAsHook, definePrototype, type DefHandle, type RunHandle } from '@proto.ui/core';
import { asCalendarRoot, asCalendarDay, CALENDAR_CONTEXT, dateAvailable } from '../calendar';
import { asPopoverRoot, asPopoverTrigger, asPopoverContent } from '../popover';
import { POPOVER_CONTEXT, requestPopoverOpen } from '../popover/shared';

function setupRoot(_def: DefHandle<DatePickerRootProps, DatePickerRootExposes>) {
  asPopoverRoot();
  asCalendarRoot();
}
export const asDatePickerRoot = defineAsHook<
  DatePickerRootProps,
  DatePickerRootExposes,
  DatePickerRootAsHookContract
>({ name: 'as-date-picker-root', setup: setupRoot });
export const datePickerRoot = definePrototype({ name: 'base-date-picker-root', setup: setupRoot });
function setupTrigger(_def: DefHandle<DatePickerTriggerProps, DatePickerTriggerExposes>) {
  asPopoverTrigger();
}
export const asDatePickerTrigger = defineAsHook<
  DatePickerTriggerProps,
  DatePickerTriggerExposes,
  DatePickerTriggerAsHookContract
>({
  name: 'as-date-picker-trigger',
  setup: setupTrigger,
});
export const datePickerTrigger = definePrototype({
  name: 'base-date-picker-trigger',
  setup: setupTrigger,
});
function setupContent(_def: DefHandle<DatePickerContentProps, DatePickerContentExposes>) {
  asPopoverContent();
}
export const asDatePickerContent = defineAsHook<
  DatePickerContentProps,
  DatePickerContentExposes,
  DatePickerContentAsHookContract
>({
  name: 'as-date-picker-content',
  setup: setupContent,
});
export const datePickerContent = definePrototype({
  name: 'base-date-picker-content',
  setup: setupContent,
});
function setupDay(def: DefHandle<DatePickerDayProps, DatePickerDayExposes>) {
  const calendar = asCalendarDay();
  def.context.subscribe(POPOVER_CONTEXT);
  def.context.subscribe(CALENDAR_CONTEXT);
  def.event.on('press.commit', (run, event) => {
    const c = run.context.read(CALENDAR_CONTEXT),
      date = calendar.stateHandles?.date.get() ?? '';
    if (
      !calendar.stateHandles?.disabled.get() &&
      !c.disabled &&
      !c.readOnly &&
      dateAvailable(date, c.min, c.max, c.unavailable)
    )
      requestPopoverOpen(run, false, 'date-selection', event.key ? 'keyboard' : 'pointer');
  });
  return calendar.render;
}
export const asDatePickerDay = defineAsHook<
  DatePickerDayProps,
  DatePickerDayExposes,
  DatePickerDayAsHookContract
>({ name: 'as-date-picker-day', setup: setupDay });
export const datePickerDay = definePrototype({ name: 'base-date-picker-day', setup: setupDay });
function setupValue(def: DefHandle<DatePickerValueProps, DatePickerValueExposes>) {
  def.props.define({ placeholder: { type: 'string' } });
  def.props.setDefaults({ placeholder: 'Pick a date' });
  const display = def.state.string('displayValue', '');
  def.expose.state('displayValue', display);
  let mounted = false;
  const sync = (run: RunHandle<{ placeholder?: string }>) => {
    const next = run.context.read(CALENDAR_CONTEXT).value || run.props.get().placeholder || '';
    if (next !== display.get()) {
      display.set(next, 'date picker display');
      if (mounted) run.update();
    }
  };
  def.context.subscribe(CALENDAR_CONTEXT, sync);
  def.lifecycle.onCreated(sync);
  def.lifecycle.onMounted((run) => {
    mounted = true;
    sync(run);
    run.update();
  });
  def.props.watchAll(sync);
  def.lifecycle.onUnmounted(() => {
    mounted = false;
  });
  return () => [display.get()];
}
export const asDatePickerValue = defineAsHook<
  DatePickerValueProps,
  DatePickerValueExposes,
  DatePickerValueAsHookContract
>({ name: 'as-date-picker-value', setup: setupValue });
export const datePickerValue = definePrototype({
  name: 'base-date-picker-value',
  setup: setupValue,
});
