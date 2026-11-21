// Compile-only consumer checks for every public Calendar and Date Picker family.
import type { ProtoAdapterExposes, ProtoAdapterProps } from '@proto.ui/adapter-base';
import type { ProtoReactProps } from '@proto.ui/adapter-react';
import type { CalendarRange } from '../src/calendar';
import * as base from '../src/calendar';
import * as basePicker from '../src/date-picker';
import * as shadcn from '../../shadcn/src/calendar';
import * as shadcnPicker from '../../shadcn/src/date-picker';
import * as brutalist from '../../brutalist/src/calendar';
import * as brutalistPicker from '../../brutalist/src/date-picker';
import * as bootstrap from '../../bootstrap-2-3-2/src/calendar';
import * as bootstrapPicker from '../../bootstrap-2-3-2/src/date-picker';
import * as liquid from '../../liquid-glass/src/calendar';
import * as liquidPicker from '../../liquid-glass/src/date-picker';

type Roots =
  | typeof base.calendarRoot
  | typeof basePicker.datePickerRoot
  | typeof shadcn.calendarRoot
  | typeof shadcnPicker.datePickerRoot
  | typeof brutalist.calendarRoot
  | typeof brutalistPicker.datePickerRoot
  | typeof bootstrap.calendarRoot
  | typeof bootstrapPicker.datePickerRoot
  | typeof liquid.calendarRoot
  | typeof liquidPicker.datePickerRoot;
type Days =
  | typeof base.calendarDay
  | typeof basePicker.datePickerDay
  | typeof shadcn.calendarDay
  | typeof shadcnPicker.datePickerDay
  | typeof brutalist.calendarDay
  | typeof brutalistPicker.datePickerDay
  | typeof bootstrap.calendarDay
  | typeof bootstrapPicker.datePickerDay
  | typeof liquid.calendarDay
  | typeof liquidPicker.datePickerDay;

const multiple: ProtoAdapterProps<Roots> = {
  mode: 'multiple',
  values: ['2026-10-01'],
  defaultValues: [],
  minSelected: 1,
  maxSelected: 4,
};
const range: ProtoAdapterProps<Roots> = {
  mode: 'range',
  range: { from: '2026-10-01' },
  defaultRange: {},
  minNights: 0,
  maxNights: 14,
};
const callbacks: ProtoReactProps<Roots> = {
  onValuesChange(payload) {
    const values: string[] = payload.values;
    void values;
  },
  onRangeChange(payload) {
    const range: CalendarRange = payload.range;
    void range;
  },
};
// @ts-expect-error Selection modes retain their exact domain across family wrappers.
const badMode: ProtoAdapterProps<Roots> = { mode: 'week' };
// @ts-expect-error A range uses civil-date strings, not Date objects.
const badRange: ProtoAdapterProps<Roots> = { range: { from: new Date() } };
// @ts-expect-error Multiple selection is a collection, not a scalar value.
const badValues: ProtoAdapterProps<Roots> = { values: '2026-10-01' };
// @ts-expect-error A count limit is numeric.
const badLimit: ProtoAdapterProps<Roots> = { maxSelected: '4' };

declare const root: ProtoAdapterExposes<Roots>;
const acceptedValues: boolean = root.requestValues(['2026-10-01']);
const acceptedRange: boolean = root.requestRange({ from: '2026-10-01', to: '2026-10-03' });
const acceptedDate: boolean = root.requestValue('2026-10-01', 'keyboard');
const values: string[] = root.getValues();
const dates: CalendarRange = root.getRange();
const count: number = root.selectedCount.get();
const complete: boolean = root.rangeComplete.get();
// @ts-expect-error Direct method requests preserve the same date domain.
root.requestValues([23]);
// @ts-expect-error Direct range requests require the named endpoints.
root.requestRange(['2026-10-01', '2026-10-03']);
// @ts-expect-error An unknown focus reason does not widen to string.
root.requestValue('2026-10-01', 'hover');

declare const day: ProtoAdapterExposes<Days>;
const start: boolean = day.rangeStart.get();
const end: boolean = day.rangeEnd.get();
const middle: boolean = day.rangeMiddle.get();
const pending: boolean = day.rangePending.get();
