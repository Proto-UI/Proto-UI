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
import { asCalendarRoot, asCalendarDay, CALENDAR_CONTEXT } from '../calendar';
import { asPopoverRoot, asPopoverTrigger, asPopoverContent } from '../popover';
import { POPOVER_CONTEXT, requestPopoverOpen } from '../popover/shared';

function setupRoot(def: DefHandle<DatePickerRootProps, DatePickerRootExposes>) {
  asPopoverRoot();
  asCalendarRoot();
  let mounted = false;
  let lastCompletion = 0;
  let lastRequest = 0;
  let requestSessionOpen = false;
  const observeRequest = (id: number, open: boolean) => {
    if (id <= lastRequest) return;
    lastRequest = id;
    requestSessionOpen = mounted && open;
  };
  def.context.subscribe(CALENDAR_CONTEXT, (run, next) => {
    // A nested request may already own the provider while an older delivery
    // finishes notifying its remaining subscribers.
    if (next.selectionRequestId !== run.context.read(CALENDAR_CONTEXT).selectionRequestId) return;
    const open = run.context.read(POPOVER_CONTEXT).open;
    observeRequest(next.selectionRequestId, open);
    const completion = next.selectionCommit;
    if (!completion || completion.id <= lastCompletion) return;
    lastCompletion = completion.id;
    if (
      completion.id !== lastRequest ||
      !mounted ||
      !requestSessionOpen ||
      !completion.complete ||
      next.disabled ||
      next.readOnly ||
      !open
    )
      return;
    requestPopoverOpen(run, false, 'date-selection', completion.reason);
  });
  def.context.subscribe(POPOVER_CONTEXT, (run, next, prev) => {
    // An earlier Calendar subscriber can change the popup before our Calendar
    // callback runs. Its actual previous open fact still identifies the session
    // at request start; a later Calendar delivery must not recapture a new one.
    observeRequest(run.context.read(CALENDAR_CONTEXT).selectionRequestId, prev.open);
    if (!next.open) requestSessionOpen = false;
  });
  def.lifecycle.onMounted(() => {
    mounted = true;
  });
  def.lifecycle.onUnmounted(() => {
    mounted = false;
    requestSessionOpen = false;
  });
  def.lifecycle.onBeforeDispose(() => {
    mounted = false;
    requestSessionOpen = false;
  });
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
function setupDay(_def: DefHandle<DatePickerDayProps, DatePickerDayExposes>) {
  const calendar = asCalendarDay();
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
    const c = run.context.read(CALENDAR_CONTEXT);
    const text =
      c.mode === 'multiple'
        ? c.values.join(', ')
        : c.mode === 'range'
          ? c.range.from
            ? c.range.to
              ? `${c.range.from} – ${c.range.to}`
              : `${c.range.from} …`
            : ''
          : c.value;
    const next = text || run.props.get().placeholder || '';
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
