// Compile-only public consumer contracts. Included by the focused TypeScript check, never executed.
import type { ProtoAdapterProps, ProtoAdapterExposes } from '@proto.ui/adapter-base';
type Assert<T extends true> = T;
type IsAny<T> = 0 extends 1 & T ? true : false;
type NotAny<T> = IsAny<T> extends true ? false : true;
import * as f0calendar from '../../base/src/calendar';
type f0calendarRootProps = ProtoAdapterProps<typeof f0calendar.calendarRoot>;
type f0calendarRootPropsNotAny = Assert<NotAny<f0calendarRootProps>>;
declare const f0calendarRoot: ProtoAdapterExposes<typeof f0calendar.calendarRoot>;
type f0calendarRootExposesNotAny = Assert<NotAny<typeof f0calendarRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0calendarRoot: f0calendarRootProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0calendarRoot.notAnExposedMethod();
type f0calendarGridProps = ProtoAdapterProps<typeof f0calendar.calendarGrid>;
type f0calendarGridPropsNotAny = Assert<NotAny<f0calendarGridProps>>;
declare const f0calendarGrid: ProtoAdapterExposes<typeof f0calendar.calendarGrid>;
type f0calendarGridExposesNotAny = Assert<NotAny<typeof f0calendarGrid>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0calendarGrid: f0calendarGridProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0calendarGrid.notAnExposedMethod();
type f0calendarRowProps = ProtoAdapterProps<typeof f0calendar.calendarRow>;
type f0calendarRowPropsNotAny = Assert<NotAny<f0calendarRowProps>>;
declare const f0calendarRow: ProtoAdapterExposes<typeof f0calendar.calendarRow>;
type f0calendarRowExposesNotAny = Assert<NotAny<typeof f0calendarRow>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0calendarRow: f0calendarRowProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0calendarRow.notAnExposedMethod();
type f0calendarDayProps = ProtoAdapterProps<typeof f0calendar.calendarDay>;
type f0calendarDayPropsNotAny = Assert<NotAny<f0calendarDayProps>>;
declare const f0calendarDay: ProtoAdapterExposes<typeof f0calendar.calendarDay>;
type f0calendarDayExposesNotAny = Assert<NotAny<typeof f0calendarDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0calendarDay: f0calendarDayProps = { offset: '1' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0calendarDay.notAnExposedMethod();
type f0calendarHeadingProps = ProtoAdapterProps<typeof f0calendar.calendarHeading>;
type f0calendarHeadingPropsNotAny = Assert<NotAny<f0calendarHeadingProps>>;
declare const f0calendarHeading: ProtoAdapterExposes<typeof f0calendar.calendarHeading>;
type f0calendarHeadingExposesNotAny = Assert<NotAny<typeof f0calendarHeading>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0calendarHeading: f0calendarHeadingProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0calendarHeading.notAnExposedMethod();
type f0calendarPreviousProps = ProtoAdapterProps<typeof f0calendar.calendarPrevious>;
type f0calendarPreviousPropsNotAny = Assert<NotAny<f0calendarPreviousProps>>;
declare const f0calendarPrevious: ProtoAdapterExposes<typeof f0calendar.calendarPrevious>;
type f0calendarPreviousExposesNotAny = Assert<NotAny<typeof f0calendarPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0calendarPrevious: f0calendarPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0calendarPrevious.notAnExposedMethod();
type f0calendarNextProps = ProtoAdapterProps<typeof f0calendar.calendarNext>;
type f0calendarNextPropsNotAny = Assert<NotAny<f0calendarNextProps>>;
declare const f0calendarNext: ProtoAdapterExposes<typeof f0calendar.calendarNext>;
type f0calendarNextExposesNotAny = Assert<NotAny<typeof f0calendarNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0calendarNext: f0calendarNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0calendarNext.notAnExposedMethod();
const f0calendarRootResult: boolean = f0calendarRoot.requestValue('2026-10-10');
const f0calendarRootValue: string = f0calendarRoot.month.get();
const f0calendarRootCount: number = f0calendarRoot.getCollectionCount();
// @ts-expect-error Date requests require date strings.
f0calendarRoot.requestValue(23);
const f0calendarDayValue: string = f0calendarDay.date.get();
f0calendarDay.focusSelf({ reason: 'keyboard' });
const f0calendarHeadingValue: string = f0calendarHeading.month.get();
const f0calendarPreviousDisabled: boolean = f0calendarPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f0calendarPrevious.focusSelf({ reason: 'invalid' });
const f0calendarNextDisabled: boolean = f0calendarNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f0calendarNext.focusSelf({ reason: 'invalid' });
import * as f0datePicker from '../../base/src/date-picker';
type f0datePickerRootProps = ProtoAdapterProps<typeof f0datePicker.datePickerRoot>;
type f0datePickerRootPropsNotAny = Assert<NotAny<f0datePickerRootProps>>;
declare const f0datePickerRoot: ProtoAdapterExposes<typeof f0datePicker.datePickerRoot>;
type f0datePickerRootExposesNotAny = Assert<NotAny<typeof f0datePickerRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0datePickerRoot: f0datePickerRootProps = { open: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0datePickerRoot.notAnExposedMethod();
type f0datePickerTriggerProps = ProtoAdapterProps<typeof f0datePicker.datePickerTrigger>;
type f0datePickerTriggerPropsNotAny = Assert<NotAny<f0datePickerTriggerProps>>;
declare const f0datePickerTrigger: ProtoAdapterExposes<typeof f0datePicker.datePickerTrigger>;
type f0datePickerTriggerExposesNotAny = Assert<NotAny<typeof f0datePickerTrigger>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0datePickerTrigger: f0datePickerTriggerProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0datePickerTrigger.notAnExposedMethod();
type f0datePickerContentProps = ProtoAdapterProps<typeof f0datePicker.datePickerContent>;
type f0datePickerContentPropsNotAny = Assert<NotAny<f0datePickerContentProps>>;
declare const f0datePickerContent: ProtoAdapterExposes<typeof f0datePicker.datePickerContent>;
type f0datePickerContentExposesNotAny = Assert<NotAny<typeof f0datePickerContent>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0datePickerContent: f0datePickerContentProps = { side: 'center' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0datePickerContent.notAnExposedMethod();
type f0datePickerDayProps = ProtoAdapterProps<typeof f0datePicker.datePickerDay>;
type f0datePickerDayPropsNotAny = Assert<NotAny<f0datePickerDayProps>>;
declare const f0datePickerDay: ProtoAdapterExposes<typeof f0datePicker.datePickerDay>;
type f0datePickerDayExposesNotAny = Assert<NotAny<typeof f0datePickerDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0datePickerDay: f0datePickerDayProps = { date: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0datePickerDay.notAnExposedMethod();
type f0datePickerValueProps = ProtoAdapterProps<typeof f0datePicker.datePickerValue>;
type f0datePickerValuePropsNotAny = Assert<NotAny<f0datePickerValueProps>>;
declare const f0datePickerValue: ProtoAdapterExposes<typeof f0datePicker.datePickerValue>;
type f0datePickerValueExposesNotAny = Assert<NotAny<typeof f0datePickerValue>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf0datePickerValue: f0datePickerValueProps = { placeholder: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f0datePickerValue.notAnExposedMethod();
const f0datePickerRootResult: boolean = f0datePickerRoot.requestValue('2026-10-10');
f0datePickerRoot.openPopover('keyboard');
const f0datePickerRootValue: boolean = f0datePickerRoot.open.get();
// @ts-expect-error Inherited Calendar requests retain their domain.
f0datePickerRoot.requestValue(23);
f0datePickerContent.enter();
const f0datePickerContentState: string = f0datePickerContent.transitionState.get();
const f0datePickerDisplay: string = f0datePickerValue.displayValue.get();
const f0datePickerTriggerDisabled: boolean = f0datePickerTrigger.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f0datePickerTrigger.focusSelf({ reason: 'invalid' });
import * as f1calendar from '../../shadcn/src/calendar';
type f1calendarRootProps = ProtoAdapterProps<typeof f1calendar.calendarRoot>;
type f1calendarRootPropsNotAny = Assert<NotAny<f1calendarRootProps>>;
declare const f1calendarRoot: ProtoAdapterExposes<typeof f1calendar.calendarRoot>;
type f1calendarRootExposesNotAny = Assert<NotAny<typeof f1calendarRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1calendarRoot: f1calendarRootProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1calendarRoot.notAnExposedMethod();
type f1calendarGridProps = ProtoAdapterProps<typeof f1calendar.calendarGrid>;
type f1calendarGridPropsNotAny = Assert<NotAny<f1calendarGridProps>>;
declare const f1calendarGrid: ProtoAdapterExposes<typeof f1calendar.calendarGrid>;
type f1calendarGridExposesNotAny = Assert<NotAny<typeof f1calendarGrid>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1calendarGrid: f1calendarGridProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1calendarGrid.notAnExposedMethod();
type f1calendarRowProps = ProtoAdapterProps<typeof f1calendar.calendarRow>;
type f1calendarRowPropsNotAny = Assert<NotAny<f1calendarRowProps>>;
declare const f1calendarRow: ProtoAdapterExposes<typeof f1calendar.calendarRow>;
type f1calendarRowExposesNotAny = Assert<NotAny<typeof f1calendarRow>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1calendarRow: f1calendarRowProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1calendarRow.notAnExposedMethod();
type f1calendarDayProps = ProtoAdapterProps<typeof f1calendar.calendarDay>;
type f1calendarDayPropsNotAny = Assert<NotAny<f1calendarDayProps>>;
declare const f1calendarDay: ProtoAdapterExposes<typeof f1calendar.calendarDay>;
type f1calendarDayExposesNotAny = Assert<NotAny<typeof f1calendarDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1calendarDay: f1calendarDayProps = { offset: '1' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1calendarDay.notAnExposedMethod();
type f1calendarHeadingProps = ProtoAdapterProps<typeof f1calendar.calendarHeading>;
type f1calendarHeadingPropsNotAny = Assert<NotAny<f1calendarHeadingProps>>;
declare const f1calendarHeading: ProtoAdapterExposes<typeof f1calendar.calendarHeading>;
type f1calendarHeadingExposesNotAny = Assert<NotAny<typeof f1calendarHeading>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1calendarHeading: f1calendarHeadingProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1calendarHeading.notAnExposedMethod();
type f1calendarPreviousProps = ProtoAdapterProps<typeof f1calendar.calendarPrevious>;
type f1calendarPreviousPropsNotAny = Assert<NotAny<f1calendarPreviousProps>>;
declare const f1calendarPrevious: ProtoAdapterExposes<typeof f1calendar.calendarPrevious>;
type f1calendarPreviousExposesNotAny = Assert<NotAny<typeof f1calendarPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1calendarPrevious: f1calendarPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1calendarPrevious.notAnExposedMethod();
type f1calendarNextProps = ProtoAdapterProps<typeof f1calendar.calendarNext>;
type f1calendarNextPropsNotAny = Assert<NotAny<f1calendarNextProps>>;
declare const f1calendarNext: ProtoAdapterExposes<typeof f1calendar.calendarNext>;
type f1calendarNextExposesNotAny = Assert<NotAny<typeof f1calendarNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1calendarNext: f1calendarNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1calendarNext.notAnExposedMethod();
const f1calendarRootResult: boolean = f1calendarRoot.requestValue('2026-10-10');
const f1calendarRootValue: string = f1calendarRoot.month.get();
const f1calendarRootCount: number = f1calendarRoot.getCollectionCount();
// @ts-expect-error Date requests require date strings.
f1calendarRoot.requestValue(23);
const f1calendarDayValue: string = f1calendarDay.date.get();
f1calendarDay.focusSelf({ reason: 'keyboard' });
const f1calendarHeadingValue: string = f1calendarHeading.month.get();
const f1calendarPreviousDisabled: boolean = f1calendarPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f1calendarPrevious.focusSelf({ reason: 'invalid' });
const f1calendarNextDisabled: boolean = f1calendarNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f1calendarNext.focusSelf({ reason: 'invalid' });
import * as f1datePicker from '../../shadcn/src/date-picker';
type f1datePickerRootProps = ProtoAdapterProps<typeof f1datePicker.datePickerRoot>;
type f1datePickerRootPropsNotAny = Assert<NotAny<f1datePickerRootProps>>;
declare const f1datePickerRoot: ProtoAdapterExposes<typeof f1datePicker.datePickerRoot>;
type f1datePickerRootExposesNotAny = Assert<NotAny<typeof f1datePickerRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1datePickerRoot: f1datePickerRootProps = { open: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1datePickerRoot.notAnExposedMethod();
type f1datePickerTriggerProps = ProtoAdapterProps<typeof f1datePicker.datePickerTrigger>;
type f1datePickerTriggerPropsNotAny = Assert<NotAny<f1datePickerTriggerProps>>;
declare const f1datePickerTrigger: ProtoAdapterExposes<typeof f1datePicker.datePickerTrigger>;
type f1datePickerTriggerExposesNotAny = Assert<NotAny<typeof f1datePickerTrigger>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1datePickerTrigger: f1datePickerTriggerProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1datePickerTrigger.notAnExposedMethod();
type f1datePickerContentProps = ProtoAdapterProps<typeof f1datePicker.datePickerContent>;
type f1datePickerContentPropsNotAny = Assert<NotAny<f1datePickerContentProps>>;
declare const f1datePickerContent: ProtoAdapterExposes<typeof f1datePicker.datePickerContent>;
type f1datePickerContentExposesNotAny = Assert<NotAny<typeof f1datePickerContent>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1datePickerContent: f1datePickerContentProps = { side: 'center' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1datePickerContent.notAnExposedMethod();
type f1datePickerDayProps = ProtoAdapterProps<typeof f1datePicker.datePickerDay>;
type f1datePickerDayPropsNotAny = Assert<NotAny<f1datePickerDayProps>>;
declare const f1datePickerDay: ProtoAdapterExposes<typeof f1datePicker.datePickerDay>;
type f1datePickerDayExposesNotAny = Assert<NotAny<typeof f1datePickerDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1datePickerDay: f1datePickerDayProps = { date: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1datePickerDay.notAnExposedMethod();
type f1datePickerValueProps = ProtoAdapterProps<typeof f1datePicker.datePickerValue>;
type f1datePickerValuePropsNotAny = Assert<NotAny<f1datePickerValueProps>>;
declare const f1datePickerValue: ProtoAdapterExposes<typeof f1datePicker.datePickerValue>;
type f1datePickerValueExposesNotAny = Assert<NotAny<typeof f1datePickerValue>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf1datePickerValue: f1datePickerValueProps = { placeholder: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f1datePickerValue.notAnExposedMethod();
const f1datePickerRootResult: boolean = f1datePickerRoot.requestValue('2026-10-10');
f1datePickerRoot.openPopover('keyboard');
const f1datePickerRootValue: boolean = f1datePickerRoot.open.get();
// @ts-expect-error Inherited Calendar requests retain their domain.
f1datePickerRoot.requestValue(23);
f1datePickerContent.enter();
const f1datePickerContentState: string = f1datePickerContent.transitionState.get();
const f1datePickerDisplay: string = f1datePickerValue.displayValue.get();
const f1datePickerTriggerDisabled: boolean = f1datePickerTrigger.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f1datePickerTrigger.focusSelf({ reason: 'invalid' });
import * as f2calendar from '../../brutalist/src/calendar';
type f2calendarRootProps = ProtoAdapterProps<typeof f2calendar.calendarRoot>;
type f2calendarRootPropsNotAny = Assert<NotAny<f2calendarRootProps>>;
declare const f2calendarRoot: ProtoAdapterExposes<typeof f2calendar.calendarRoot>;
type f2calendarRootExposesNotAny = Assert<NotAny<typeof f2calendarRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2calendarRoot: f2calendarRootProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2calendarRoot.notAnExposedMethod();
type f2calendarGridProps = ProtoAdapterProps<typeof f2calendar.calendarGrid>;
type f2calendarGridPropsNotAny = Assert<NotAny<f2calendarGridProps>>;
declare const f2calendarGrid: ProtoAdapterExposes<typeof f2calendar.calendarGrid>;
type f2calendarGridExposesNotAny = Assert<NotAny<typeof f2calendarGrid>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2calendarGrid: f2calendarGridProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2calendarGrid.notAnExposedMethod();
type f2calendarRowProps = ProtoAdapterProps<typeof f2calendar.calendarRow>;
type f2calendarRowPropsNotAny = Assert<NotAny<f2calendarRowProps>>;
declare const f2calendarRow: ProtoAdapterExposes<typeof f2calendar.calendarRow>;
type f2calendarRowExposesNotAny = Assert<NotAny<typeof f2calendarRow>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2calendarRow: f2calendarRowProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2calendarRow.notAnExposedMethod();
type f2calendarDayProps = ProtoAdapterProps<typeof f2calendar.calendarDay>;
type f2calendarDayPropsNotAny = Assert<NotAny<f2calendarDayProps>>;
declare const f2calendarDay: ProtoAdapterExposes<typeof f2calendar.calendarDay>;
type f2calendarDayExposesNotAny = Assert<NotAny<typeof f2calendarDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2calendarDay: f2calendarDayProps = { offset: '1' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2calendarDay.notAnExposedMethod();
type f2calendarHeadingProps = ProtoAdapterProps<typeof f2calendar.calendarHeading>;
type f2calendarHeadingPropsNotAny = Assert<NotAny<f2calendarHeadingProps>>;
declare const f2calendarHeading: ProtoAdapterExposes<typeof f2calendar.calendarHeading>;
type f2calendarHeadingExposesNotAny = Assert<NotAny<typeof f2calendarHeading>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2calendarHeading: f2calendarHeadingProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2calendarHeading.notAnExposedMethod();
type f2calendarPreviousProps = ProtoAdapterProps<typeof f2calendar.calendarPrevious>;
type f2calendarPreviousPropsNotAny = Assert<NotAny<f2calendarPreviousProps>>;
declare const f2calendarPrevious: ProtoAdapterExposes<typeof f2calendar.calendarPrevious>;
type f2calendarPreviousExposesNotAny = Assert<NotAny<typeof f2calendarPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2calendarPrevious: f2calendarPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2calendarPrevious.notAnExposedMethod();
type f2calendarNextProps = ProtoAdapterProps<typeof f2calendar.calendarNext>;
type f2calendarNextPropsNotAny = Assert<NotAny<f2calendarNextProps>>;
declare const f2calendarNext: ProtoAdapterExposes<typeof f2calendar.calendarNext>;
type f2calendarNextExposesNotAny = Assert<NotAny<typeof f2calendarNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2calendarNext: f2calendarNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2calendarNext.notAnExposedMethod();
const f2calendarRootResult: boolean = f2calendarRoot.requestValue('2026-10-10');
const f2calendarRootValue: string = f2calendarRoot.month.get();
const f2calendarRootCount: number = f2calendarRoot.getCollectionCount();
// @ts-expect-error Date requests require date strings.
f2calendarRoot.requestValue(23);
const f2calendarDayValue: string = f2calendarDay.date.get();
f2calendarDay.focusSelf({ reason: 'keyboard' });
const f2calendarHeadingValue: string = f2calendarHeading.month.get();
const f2calendarPreviousDisabled: boolean = f2calendarPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f2calendarPrevious.focusSelf({ reason: 'invalid' });
const f2calendarNextDisabled: boolean = f2calendarNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f2calendarNext.focusSelf({ reason: 'invalid' });
import * as f2datePicker from '../../brutalist/src/date-picker';
type f2datePickerRootProps = ProtoAdapterProps<typeof f2datePicker.datePickerRoot>;
type f2datePickerRootPropsNotAny = Assert<NotAny<f2datePickerRootProps>>;
declare const f2datePickerRoot: ProtoAdapterExposes<typeof f2datePicker.datePickerRoot>;
type f2datePickerRootExposesNotAny = Assert<NotAny<typeof f2datePickerRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2datePickerRoot: f2datePickerRootProps = { open: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2datePickerRoot.notAnExposedMethod();
type f2datePickerTriggerProps = ProtoAdapterProps<typeof f2datePicker.datePickerTrigger>;
type f2datePickerTriggerPropsNotAny = Assert<NotAny<f2datePickerTriggerProps>>;
declare const f2datePickerTrigger: ProtoAdapterExposes<typeof f2datePicker.datePickerTrigger>;
type f2datePickerTriggerExposesNotAny = Assert<NotAny<typeof f2datePickerTrigger>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2datePickerTrigger: f2datePickerTriggerProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2datePickerTrigger.notAnExposedMethod();
type f2datePickerContentProps = ProtoAdapterProps<typeof f2datePicker.datePickerContent>;
type f2datePickerContentPropsNotAny = Assert<NotAny<f2datePickerContentProps>>;
declare const f2datePickerContent: ProtoAdapterExposes<typeof f2datePicker.datePickerContent>;
type f2datePickerContentExposesNotAny = Assert<NotAny<typeof f2datePickerContent>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2datePickerContent: f2datePickerContentProps = { side: 'center' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2datePickerContent.notAnExposedMethod();
type f2datePickerDayProps = ProtoAdapterProps<typeof f2datePicker.datePickerDay>;
type f2datePickerDayPropsNotAny = Assert<NotAny<f2datePickerDayProps>>;
declare const f2datePickerDay: ProtoAdapterExposes<typeof f2datePicker.datePickerDay>;
type f2datePickerDayExposesNotAny = Assert<NotAny<typeof f2datePickerDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2datePickerDay: f2datePickerDayProps = { date: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2datePickerDay.notAnExposedMethod();
type f2datePickerValueProps = ProtoAdapterProps<typeof f2datePicker.datePickerValue>;
type f2datePickerValuePropsNotAny = Assert<NotAny<f2datePickerValueProps>>;
declare const f2datePickerValue: ProtoAdapterExposes<typeof f2datePicker.datePickerValue>;
type f2datePickerValueExposesNotAny = Assert<NotAny<typeof f2datePickerValue>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf2datePickerValue: f2datePickerValueProps = { placeholder: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f2datePickerValue.notAnExposedMethod();
const f2datePickerRootResult: boolean = f2datePickerRoot.requestValue('2026-10-10');
f2datePickerRoot.openPopover('keyboard');
const f2datePickerRootValue: boolean = f2datePickerRoot.open.get();
// @ts-expect-error Inherited Calendar requests retain their domain.
f2datePickerRoot.requestValue(23);
f2datePickerContent.enter();
const f2datePickerContentState: string = f2datePickerContent.transitionState.get();
const f2datePickerDisplay: string = f2datePickerValue.displayValue.get();
const f2datePickerTriggerDisabled: boolean = f2datePickerTrigger.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f2datePickerTrigger.focusSelf({ reason: 'invalid' });
import * as f3calendar from '../../bootstrap-2-3-2/src/calendar';
type f3calendarRootProps = ProtoAdapterProps<typeof f3calendar.calendarRoot>;
type f3calendarRootPropsNotAny = Assert<NotAny<f3calendarRootProps>>;
declare const f3calendarRoot: ProtoAdapterExposes<typeof f3calendar.calendarRoot>;
type f3calendarRootExposesNotAny = Assert<NotAny<typeof f3calendarRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3calendarRoot: f3calendarRootProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3calendarRoot.notAnExposedMethod();
type f3calendarGridProps = ProtoAdapterProps<typeof f3calendar.calendarGrid>;
type f3calendarGridPropsNotAny = Assert<NotAny<f3calendarGridProps>>;
declare const f3calendarGrid: ProtoAdapterExposes<typeof f3calendar.calendarGrid>;
type f3calendarGridExposesNotAny = Assert<NotAny<typeof f3calendarGrid>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3calendarGrid: f3calendarGridProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3calendarGrid.notAnExposedMethod();
type f3calendarRowProps = ProtoAdapterProps<typeof f3calendar.calendarRow>;
type f3calendarRowPropsNotAny = Assert<NotAny<f3calendarRowProps>>;
declare const f3calendarRow: ProtoAdapterExposes<typeof f3calendar.calendarRow>;
type f3calendarRowExposesNotAny = Assert<NotAny<typeof f3calendarRow>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3calendarRow: f3calendarRowProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3calendarRow.notAnExposedMethod();
type f3calendarDayProps = ProtoAdapterProps<typeof f3calendar.calendarDay>;
type f3calendarDayPropsNotAny = Assert<NotAny<f3calendarDayProps>>;
declare const f3calendarDay: ProtoAdapterExposes<typeof f3calendar.calendarDay>;
type f3calendarDayExposesNotAny = Assert<NotAny<typeof f3calendarDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3calendarDay: f3calendarDayProps = { offset: '1' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3calendarDay.notAnExposedMethod();
type f3calendarHeadingProps = ProtoAdapterProps<typeof f3calendar.calendarHeading>;
type f3calendarHeadingPropsNotAny = Assert<NotAny<f3calendarHeadingProps>>;
declare const f3calendarHeading: ProtoAdapterExposes<typeof f3calendar.calendarHeading>;
type f3calendarHeadingExposesNotAny = Assert<NotAny<typeof f3calendarHeading>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3calendarHeading: f3calendarHeadingProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3calendarHeading.notAnExposedMethod();
type f3calendarPreviousProps = ProtoAdapterProps<typeof f3calendar.calendarPrevious>;
type f3calendarPreviousPropsNotAny = Assert<NotAny<f3calendarPreviousProps>>;
declare const f3calendarPrevious: ProtoAdapterExposes<typeof f3calendar.calendarPrevious>;
type f3calendarPreviousExposesNotAny = Assert<NotAny<typeof f3calendarPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3calendarPrevious: f3calendarPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3calendarPrevious.notAnExposedMethod();
type f3calendarNextProps = ProtoAdapterProps<typeof f3calendar.calendarNext>;
type f3calendarNextPropsNotAny = Assert<NotAny<f3calendarNextProps>>;
declare const f3calendarNext: ProtoAdapterExposes<typeof f3calendar.calendarNext>;
type f3calendarNextExposesNotAny = Assert<NotAny<typeof f3calendarNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3calendarNext: f3calendarNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3calendarNext.notAnExposedMethod();
const f3calendarRootResult: boolean = f3calendarRoot.requestValue('2026-10-10');
const f3calendarRootValue: string = f3calendarRoot.month.get();
const f3calendarRootCount: number = f3calendarRoot.getCollectionCount();
// @ts-expect-error Date requests require date strings.
f3calendarRoot.requestValue(23);
const f3calendarDayValue: string = f3calendarDay.date.get();
f3calendarDay.focusSelf({ reason: 'keyboard' });
const f3calendarHeadingValue: string = f3calendarHeading.month.get();
const f3calendarPreviousDisabled: boolean = f3calendarPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f3calendarPrevious.focusSelf({ reason: 'invalid' });
const f3calendarNextDisabled: boolean = f3calendarNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f3calendarNext.focusSelf({ reason: 'invalid' });
import * as f3datePicker from '../../bootstrap-2-3-2/src/date-picker';
type f3datePickerRootProps = ProtoAdapterProps<typeof f3datePicker.datePickerRoot>;
type f3datePickerRootPropsNotAny = Assert<NotAny<f3datePickerRootProps>>;
declare const f3datePickerRoot: ProtoAdapterExposes<typeof f3datePicker.datePickerRoot>;
type f3datePickerRootExposesNotAny = Assert<NotAny<typeof f3datePickerRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3datePickerRoot: f3datePickerRootProps = { open: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3datePickerRoot.notAnExposedMethod();
type f3datePickerTriggerProps = ProtoAdapterProps<typeof f3datePicker.datePickerTrigger>;
type f3datePickerTriggerPropsNotAny = Assert<NotAny<f3datePickerTriggerProps>>;
declare const f3datePickerTrigger: ProtoAdapterExposes<typeof f3datePicker.datePickerTrigger>;
type f3datePickerTriggerExposesNotAny = Assert<NotAny<typeof f3datePickerTrigger>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3datePickerTrigger: f3datePickerTriggerProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3datePickerTrigger.notAnExposedMethod();
type f3datePickerContentProps = ProtoAdapterProps<typeof f3datePicker.datePickerContent>;
type f3datePickerContentPropsNotAny = Assert<NotAny<f3datePickerContentProps>>;
declare const f3datePickerContent: ProtoAdapterExposes<typeof f3datePicker.datePickerContent>;
type f3datePickerContentExposesNotAny = Assert<NotAny<typeof f3datePickerContent>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3datePickerContent: f3datePickerContentProps = { side: 'center' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3datePickerContent.notAnExposedMethod();
type f3datePickerDayProps = ProtoAdapterProps<typeof f3datePicker.datePickerDay>;
type f3datePickerDayPropsNotAny = Assert<NotAny<f3datePickerDayProps>>;
declare const f3datePickerDay: ProtoAdapterExposes<typeof f3datePicker.datePickerDay>;
type f3datePickerDayExposesNotAny = Assert<NotAny<typeof f3datePickerDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3datePickerDay: f3datePickerDayProps = { date: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3datePickerDay.notAnExposedMethod();
type f3datePickerValueProps = ProtoAdapterProps<typeof f3datePicker.datePickerValue>;
type f3datePickerValuePropsNotAny = Assert<NotAny<f3datePickerValueProps>>;
declare const f3datePickerValue: ProtoAdapterExposes<typeof f3datePicker.datePickerValue>;
type f3datePickerValueExposesNotAny = Assert<NotAny<typeof f3datePickerValue>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf3datePickerValue: f3datePickerValueProps = { placeholder: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f3datePickerValue.notAnExposedMethod();
const f3datePickerRootResult: boolean = f3datePickerRoot.requestValue('2026-10-10');
f3datePickerRoot.openPopover('keyboard');
const f3datePickerRootValue: boolean = f3datePickerRoot.open.get();
// @ts-expect-error Inherited Calendar requests retain their domain.
f3datePickerRoot.requestValue(23);
f3datePickerContent.enter();
const f3datePickerContentState: string = f3datePickerContent.transitionState.get();
const f3datePickerDisplay: string = f3datePickerValue.displayValue.get();
const f3datePickerTriggerDisabled: boolean = f3datePickerTrigger.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f3datePickerTrigger.focusSelf({ reason: 'invalid' });
import * as f4calendar from '../../liquid-glass/src/calendar';
type f4calendarRootProps = ProtoAdapterProps<typeof f4calendar.calendarRoot>;
type f4calendarRootPropsNotAny = Assert<NotAny<f4calendarRootProps>>;
declare const f4calendarRoot: ProtoAdapterExposes<typeof f4calendar.calendarRoot>;
type f4calendarRootExposesNotAny = Assert<NotAny<typeof f4calendarRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4calendarRoot: f4calendarRootProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4calendarRoot.notAnExposedMethod();
type f4calendarGridProps = ProtoAdapterProps<typeof f4calendar.calendarGrid>;
type f4calendarGridPropsNotAny = Assert<NotAny<f4calendarGridProps>>;
declare const f4calendarGrid: ProtoAdapterExposes<typeof f4calendar.calendarGrid>;
type f4calendarGridExposesNotAny = Assert<NotAny<typeof f4calendarGrid>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4calendarGrid: f4calendarGridProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4calendarGrid.notAnExposedMethod();
type f4calendarRowProps = ProtoAdapterProps<typeof f4calendar.calendarRow>;
type f4calendarRowPropsNotAny = Assert<NotAny<f4calendarRowProps>>;
declare const f4calendarRow: ProtoAdapterExposes<typeof f4calendar.calendarRow>;
type f4calendarRowExposesNotAny = Assert<NotAny<typeof f4calendarRow>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4calendarRow: f4calendarRowProps = { notAProp: true };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4calendarRow.notAnExposedMethod();
type f4calendarDayProps = ProtoAdapterProps<typeof f4calendar.calendarDay>;
type f4calendarDayPropsNotAny = Assert<NotAny<f4calendarDayProps>>;
declare const f4calendarDay: ProtoAdapterExposes<typeof f4calendar.calendarDay>;
type f4calendarDayExposesNotAny = Assert<NotAny<typeof f4calendarDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4calendarDay: f4calendarDayProps = { offset: '1' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4calendarDay.notAnExposedMethod();
type f4calendarHeadingProps = ProtoAdapterProps<typeof f4calendar.calendarHeading>;
type f4calendarHeadingPropsNotAny = Assert<NotAny<f4calendarHeadingProps>>;
declare const f4calendarHeading: ProtoAdapterExposes<typeof f4calendar.calendarHeading>;
type f4calendarHeadingExposesNotAny = Assert<NotAny<typeof f4calendarHeading>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4calendarHeading: f4calendarHeadingProps = { month: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4calendarHeading.notAnExposedMethod();
type f4calendarPreviousProps = ProtoAdapterProps<typeof f4calendar.calendarPrevious>;
type f4calendarPreviousPropsNotAny = Assert<NotAny<f4calendarPreviousProps>>;
declare const f4calendarPrevious: ProtoAdapterExposes<typeof f4calendar.calendarPrevious>;
type f4calendarPreviousExposesNotAny = Assert<NotAny<typeof f4calendarPrevious>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4calendarPrevious: f4calendarPreviousProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4calendarPrevious.notAnExposedMethod();
type f4calendarNextProps = ProtoAdapterProps<typeof f4calendar.calendarNext>;
type f4calendarNextPropsNotAny = Assert<NotAny<f4calendarNextProps>>;
declare const f4calendarNext: ProtoAdapterExposes<typeof f4calendar.calendarNext>;
type f4calendarNextExposesNotAny = Assert<NotAny<typeof f4calendarNext>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4calendarNext: f4calendarNextProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4calendarNext.notAnExposedMethod();
const f4calendarRootResult: boolean = f4calendarRoot.requestValue('2026-10-10');
const f4calendarRootValue: string = f4calendarRoot.month.get();
const f4calendarRootCount: number = f4calendarRoot.getCollectionCount();
// @ts-expect-error Date requests require date strings.
f4calendarRoot.requestValue(23);
const f4calendarDayValue: string = f4calendarDay.date.get();
f4calendarDay.focusSelf({ reason: 'keyboard' });
const f4calendarHeadingValue: string = f4calendarHeading.month.get();
const f4calendarPreviousDisabled: boolean = f4calendarPrevious.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f4calendarPrevious.focusSelf({ reason: 'invalid' });
const f4calendarNextDisabled: boolean = f4calendarNext.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f4calendarNext.focusSelf({ reason: 'invalid' });
import * as f4datePicker from '../../liquid-glass/src/date-picker';
type f4datePickerRootProps = ProtoAdapterProps<typeof f4datePicker.datePickerRoot>;
type f4datePickerRootPropsNotAny = Assert<NotAny<f4datePickerRootProps>>;
declare const f4datePickerRoot: ProtoAdapterExposes<typeof f4datePicker.datePickerRoot>;
type f4datePickerRootExposesNotAny = Assert<NotAny<typeof f4datePickerRoot>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4datePickerRoot: f4datePickerRootProps = { open: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4datePickerRoot.notAnExposedMethod();
type f4datePickerTriggerProps = ProtoAdapterProps<typeof f4datePicker.datePickerTrigger>;
type f4datePickerTriggerPropsNotAny = Assert<NotAny<f4datePickerTriggerProps>>;
declare const f4datePickerTrigger: ProtoAdapterExposes<typeof f4datePicker.datePickerTrigger>;
type f4datePickerTriggerExposesNotAny = Assert<NotAny<typeof f4datePickerTrigger>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4datePickerTrigger: f4datePickerTriggerProps = { disabled: 'yes' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4datePickerTrigger.notAnExposedMethod();
type f4datePickerContentProps = ProtoAdapterProps<typeof f4datePicker.datePickerContent>;
type f4datePickerContentPropsNotAny = Assert<NotAny<f4datePickerContentProps>>;
declare const f4datePickerContent: ProtoAdapterExposes<typeof f4datePicker.datePickerContent>;
type f4datePickerContentExposesNotAny = Assert<NotAny<typeof f4datePickerContent>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4datePickerContent: f4datePickerContentProps = { side: 'center' };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4datePickerContent.notAnExposedMethod();
type f4datePickerDayProps = ProtoAdapterProps<typeof f4datePicker.datePickerDay>;
type f4datePickerDayPropsNotAny = Assert<NotAny<f4datePickerDayProps>>;
declare const f4datePickerDay: ProtoAdapterExposes<typeof f4datePicker.datePickerDay>;
type f4datePickerDayExposesNotAny = Assert<NotAny<typeof f4datePickerDay>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4datePickerDay: f4datePickerDayProps = { date: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4datePickerDay.notAnExposedMethod();
type f4datePickerValueProps = ProtoAdapterProps<typeof f4datePicker.datePickerValue>;
type f4datePickerValuePropsNotAny = Assert<NotAny<f4datePickerValueProps>>;
declare const f4datePickerValue: ProtoAdapterExposes<typeof f4datePicker.datePickerValue>;
type f4datePickerValueExposesNotAny = Assert<NotAny<typeof f4datePickerValue>>;
// @ts-expect-error The public atom rejects an invalid prop domain.
const invalidf4datePickerValue: f4datePickerValueProps = { placeholder: 23 };
// @ts-expect-error Unknown instance methods do not become any/unknown index signatures.
f4datePickerValue.notAnExposedMethod();
const f4datePickerRootResult: boolean = f4datePickerRoot.requestValue('2026-10-10');
f4datePickerRoot.openPopover('keyboard');
const f4datePickerRootValue: boolean = f4datePickerRoot.open.get();
// @ts-expect-error Inherited Calendar requests retain their domain.
f4datePickerRoot.requestValue(23);
f4datePickerContent.enter();
const f4datePickerContentState: string = f4datePickerContent.transitionState.get();
const f4datePickerDisplay: string = f4datePickerValue.displayValue.get();
const f4datePickerTriggerDisabled: boolean = f4datePickerTrigger.disabled.get();
// @ts-expect-error Focus reasons are constrained.
f4datePickerTrigger.focusSelf({ reason: 'invalid' });
import { asCalendarRoot, asCalendarDay, asCalendarPrevious } from '../src/calendar';
import {
  asDatePickerRoot,
  asDatePickerDay,
  asDatePickerContent,
  asDatePickerValue,
} from '../src/date-picker';
declare const hCalendarRoot: ReturnType<typeof asCalendarRoot>;
declare const hCalendarDay: ReturnType<typeof asCalendarDay>;
declare const hCalendarPrevious: ReturnType<typeof asCalendarPrevious>;
declare const hDatePickerRoot: ReturnType<typeof asDatePickerRoot>;
declare const hDatePickerDay: ReturnType<typeof asDatePickerDay>;
declare const hDatePickerContent: ReturnType<typeof asDatePickerContent>;
declare const hDatePickerValue: ReturnType<typeof asDatePickerValue>;
const calendarHandleValue: string | undefined = hCalendarRoot.stateHandles?.value.get();
const calendarHandleCount: number | undefined = hCalendarRoot.stateHandles?.collectionCount.get();
// @ts-expect-error AsHook names follow captured state names, not exposed aliases.
hCalendarRoot.stateHandles?.count.get();
// @ts-expect-error Captured date state cannot be assigned a number.
hCalendarDay.stateHandles?.date.set(23);
const calendarButtonDisabled: boolean | undefined = hCalendarPrevious
  .getAsHookHandle?.('as-button')
  ?.stateHandles?.disabled.get();
// @ts-expect-error Nested authored Button states are not flattened into the parent hook.
hCalendarPrevious.stateHandles?.disabled.get();
const datePickerValue: string | undefined = hDatePickerRoot
  .getAsHookHandle?.('as-calendar-root')
  ?.stateHandles?.value.get();
const datePickerOpen: boolean | undefined = hDatePickerRoot
  .getAsHookHandle?.('as-popover-root')
  ?.getAsHookHandle?.('useOpenState')
  ?.stateHandles?.open.get();
const datePickerDay: string | undefined = hDatePickerDay
  .getAsHookHandle?.('as-calendar-day')
  ?.stateHandles?.date.get();
hDatePickerContent
  .getAsHookHandle?.('as-popover-content')
  ?.asTransition.configure({ enterDuration: 25 });
// @ts-expect-error Nested transition configuration retains its numeric domain.
hDatePickerContent
  .getAsHookHandle?.('as-popover-content')
  ?.asTransition.configure({ enterDuration: '25' });
const datePickerDisplay: string | undefined = hDatePickerValue.stateHandles?.displayValue.get();
// @ts-expect-error Date Picker does not flatten child Calendar state handles.
hDatePickerRoot.stateHandles?.value.get();
