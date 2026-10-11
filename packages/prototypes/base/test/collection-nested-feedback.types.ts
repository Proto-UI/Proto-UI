// Compile-only consumers of real named nested public handles, not equality to unknown.
import { asCarouselPrevious, asCarouselNext } from '../src/carousel';
declare const carouselPrevious: ReturnType<typeof asCarouselPrevious>;
const carouselPreviousDisabled: boolean =
  carouselPrevious.getAsHookHandle!('as-button')!.stateHandles!.disabled.get();
const carouselPreviousPressed: boolean =
  carouselPrevious.getAsHookHandle!('as-button')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const carouselPreviousInvalid: number =
  carouselPrevious.getAsHookHandle!('as-button')!.stateHandles!.focusVisible.get();
declare const carouselNext: ReturnType<typeof asCarouselNext>;
const carouselNextDisabled: boolean =
  carouselNext.getAsHookHandle!('as-button')!.stateHandles!.disabled.get();
const carouselNextPressed: boolean =
  carouselNext.getAsHookHandle!('as-button')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const carouselNextInvalid: number =
  carouselNext.getAsHookHandle!('as-button')!.stateHandles!.focusVisible.get();
import { asTreeToggle } from '../src/tree';
declare const treeToggle: ReturnType<typeof asTreeToggle>;
const treeToggleDisabled: boolean =
  treeToggle.getAsHookHandle!('as-button')!.stateHandles!.disabled.get();
const treeTogglePressed: boolean =
  treeToggle.getAsHookHandle!('as-button')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const treeToggleInvalid: number =
  treeToggle.getAsHookHandle!('as-button')!.stateHandles!.focusVisible.get();
import { asMessageScrollerJump } from '../src/message-scroller';
declare const messageScrollerJump: ReturnType<typeof asMessageScrollerJump>;
const messageScrollerJumpDisabled: boolean =
  messageScrollerJump.getAsHookHandle!('as-button')!.stateHandles!.disabled.get();
const messageScrollerJumpPressed: boolean =
  messageScrollerJump.getAsHookHandle!('as-button')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const messageScrollerJumpInvalid: number =
  messageScrollerJump.getAsHookHandle!('as-button')!.stateHandles!.focusVisible.get();
import { asDataTablePrevious, asDataTableNext } from '../src/data-table';
declare const dataTablePrevious: ReturnType<typeof asDataTablePrevious>;
const dataTablePreviousDisabled: boolean =
  dataTablePrevious.getAsHookHandle!('as-button')!.stateHandles!.disabled.get();
const dataTablePreviousPressed: boolean =
  dataTablePrevious.getAsHookHandle!('as-button')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const dataTablePreviousInvalid: number =
  dataTablePrevious.getAsHookHandle!('as-button')!.stateHandles!.focusVisible.get();
declare const dataTableNext: ReturnType<typeof asDataTableNext>;
const dataTableNextDisabled: boolean =
  dataTableNext.getAsHookHandle!('as-button')!.stateHandles!.disabled.get();
const dataTableNextPressed: boolean =
  dataTableNext.getAsHookHandle!('as-button')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const dataTableNextInvalid: number =
  dataTableNext.getAsHookHandle!('as-button')!.stateHandles!.focusVisible.get();
import { asDatePickerTrigger, asDatePickerDay } from '../src/date-picker';
declare const datePickerTrigger: ReturnType<typeof asDatePickerTrigger>;
const datePickerTriggerDisabled: boolean =
  datePickerTrigger.getAsHookHandle!('as-popover-trigger')!.stateHandles!.disabled.get();
const datePickerTriggerPressed: boolean =
  datePickerTrigger.getAsHookHandle!('as-popover-trigger')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const datePickerTriggerInvalid: number =
  datePickerTrigger.getAsHookHandle!('as-popover-trigger')!.stateHandles!.focusVisible.get();
declare const datePickerDay: ReturnType<typeof asDatePickerDay>;
const datePickerDayDisabled: boolean =
  datePickerDay.getAsHookHandle!('as-calendar-day')!.stateHandles!.disabled.get();
const datePickerDayPressed: boolean =
  datePickerDay.getAsHookHandle!('as-calendar-day')!.stateHandles!.pressed.get();
// @ts-expect-error A known captured state retains its boolean domain.
const datePickerDayInvalid: number =
  datePickerDay.getAsHookHandle!('as-calendar-day')!.stateHandles!.focusVisible.get();

import { asMessageScrollerViewport } from '../src/message-scroller';
declare const viewport: ReturnType<typeof asMessageScrollerViewport>;
const viewportFocus: boolean =
  viewport.getAsHookHandle!('as-scroll-area-viewport')!.stateHandles!.focusVisible.get();
// @ts-expect-error The ScrollArea public captured focus fact is boolean.
const invalidViewportFocus: number =
  viewport.getAsHookHandle!('as-scroll-area-viewport')!.stateHandles!.focusVisible.get();
