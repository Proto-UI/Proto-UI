import type { ExposeState, State, AsHookResult } from '@proto.ui/core';
export type DatePickerRootProps = import('../calendar').CalendarRootProps &
  import('../popover').PopoverRootProps;
export type DatePickerRootExposes = import('../calendar').CalendarRootExposes &
  import('../popover').PopoverRootExposes;
export type DatePickerRootAsHookContract = {
  asHooks: {
    'as-calendar-root': ReturnType<typeof import('../calendar').asCalendarRoot>;
    'as-popover-root': DatePickerPopoverRootHandle;
  };
};
export type DatePickerTriggerProps = import('../popover').PopoverTriggerProps;
export type DatePickerTriggerExposes = import('../popover').PopoverTriggerExposes;
export type DatePickerTriggerAsHookContract = {
  asHooks: { 'as-popover-trigger': ReturnType<typeof import('../popover').asPopoverTrigger> };
};
export type DatePickerContentProps = import('../popover').PopoverContentProps;
export type DatePickerContentExposes = import('../popover').PopoverContentExposes;
export type DatePickerContentAsHookContract = {
  asHooks: { 'as-popover-content': ReturnType<typeof import('../popover').asPopoverContent> };
};
export type DatePickerDayProps = import('../calendar').CalendarDayProps;
export type DatePickerDayExposes = import('../calendar').CalendarDayExposes;
export type DatePickerDayAsHookContract = {
  asHooks: { 'as-calendar-day': ReturnType<typeof import('../calendar').asCalendarDay> };
};
export interface DatePickerValueProps {
  placeholder?: string;
}
export type DatePickerValueExposes = { displayValue: ExposeState<string> };
export type DatePickerValueAsHookContract = { state: { displayValue: State<string> } };

/** Captured Popover open state is owned by its authored useOpenState child. */
export type DatePickerPopoverRootHandle = AsHookResult<
  import('../popover').PopoverRootProps,
  {
    asHooks: { useOpenState: ReturnType<typeof import('../tools').useOpenState> };
  }
>;
