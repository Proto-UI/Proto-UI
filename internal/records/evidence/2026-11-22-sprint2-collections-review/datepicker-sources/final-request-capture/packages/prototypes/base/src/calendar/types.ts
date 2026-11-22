import type {
  ObservedStateHandle,
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
  FocusRequestOptions,
  CollectionExposes,
  CollectionItemExposes,
  AsHookResult,
  RunHandle,
} from '@proto.ui/core';
export type CalendarSelectionMode = 'single' | 'multiple' | 'range';
export type CalendarSelectionReason = 'pointer' | 'keyboard' | 'programmatic';
/** Empty {}, an unfinished { from }, or inclusive ordered { from, to }. */
export type CalendarRange = {
  from?: string;
  to?: string;
};
export interface CalendarRootProps {
  mode?: CalendarSelectionMode;
  value?: string;
  defaultValue?: string;
  values?: readonly string[];
  defaultValues?: readonly string[];
  range?: CalendarRange;
  defaultRange?: CalendarRange;
  minSelected?: number;
  maxSelected?: number;
  minNights?: number;
  maxNights?: number;
  month?: string;
  defaultMonth?: string;
  min?: string;
  max?: string;
  unavailable?: readonly string[];
  disabled?: boolean;
  readOnly?: boolean;
  weekStartsOn?: number;
  /** Reserve six weeks; otherwise use the minimum complete weeks covering the month. */
  fixedWeeks?: boolean;
  a11yLabel?: string;
  /** Civil date supplied by the host clock; omitted means no today marker. */
  today?: string;
  locale?: string;
  direction?: 'ltr' | 'rtl';
}
/** Read during capture only; no effects or retained callback RunHandle. */
export type CalendarSelectionCapture = (
  request: Readonly<{
    id: number;
    viewEpoch: number;
    context: Pick<RunHandle<CalendarRootProps>['context'], 'read'>;
  }>
) => void;
export type CalendarRootExposes = CollectionExposes & {
  value: ExposeState<string>;
  mode: ExposeState<string>;
  selectedCount: ExposeState<number>;
  rangeComplete: ExposeState<boolean>;
  month: ExposeState<string>;
  weekCount: ExposeState<number>;
  disabled: ExposeState<boolean>;
  direction: ExposeState<string>;
  valueChange: ExposeEvent<{ value: string }>;
  valuesChange: ExposeEvent<{ values: string[] }>;
  rangeChange: ExposeEvent<{ range: CalendarRange }>;
  monthChange: ExposeEvent<{ month: string }>;
  requestValue: ExposeMethod<(value: string, reason?: CalendarSelectionReason) => boolean>;
  requestValues: ExposeMethod<(values: readonly string[]) => boolean>;
  requestRange: ExposeMethod<(range: CalendarRange) => boolean>;
  getValues: ExposeMethod<() => string[]>;
  getRange: ExposeMethod<() => CalendarRange>;
  requestMonth: ExposeMethod<(month: string) => boolean>;
  /** Composition registration is setup-only; runtime registration is a phase error. */
  registerSelectionCapture: ExposeMethod<(capture: CalendarSelectionCapture) => boolean>;
};
export interface CalendarDayProps {
  date?: string;
  offset?: number;
  disabled?: boolean;
}
export type CalendarDayExposes = CollectionItemExposes & {
  date: ExposeState<string>;
  selected: ExposeState<boolean>;
  rangeStart: ExposeState<boolean>;
  rangeEnd: ExposeState<boolean>;
  rangeMiddle: ExposeState<boolean>;
  rangePending: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  outside: ExposeState<boolean>;
  hidden: ExposeState<boolean>;
  today: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<(options?: FocusRequestOptions) => void>;
};
export type CalendarDayContract = {
  state: {
    collectionIndex: State<number>;
    collectionTotal: State<number>;
    collectionFirst: State<boolean>;
    collectionLast: State<boolean>;
    date: State<string>;
    selected: State<boolean>;
    rangeStart: State<boolean>;
    rangeEnd: State<boolean>;
    rangeMiddle: State<boolean>;
    rangePending: State<boolean>;
    disabled: State<boolean>;
    outside: State<boolean>;
    hidden: State<boolean>;
    today: State<boolean>;
    hovered: State<boolean>;
    pressed: State<boolean>;
    dateLabel: State<string>;
    current: State<string>;
    focused: ObservedStateHandle<boolean, CalendarDayProps>;
    focusVisible: ObservedStateHandle<boolean, CalendarDayProps>;
  };
};

export type CalendarRootAsHookContract = {
  state: {
    collectionCount: State<number>;
    value: State<string>;
    mode: State<string>;
    selectedCount: State<number>;
    rangeComplete: State<boolean>;
    month: State<string>;
    weekCount: State<number>;
    a11yLabel: State<string>;
    disabled: State<boolean>;
    direction: State<string>;
  };
};
export type CalendarRootHandles = AsHookResult<CalendarRootProps, CalendarRootAsHookContract> & {
  registerSelectionCapture(capture: CalendarSelectionCapture): boolean;
};
export type CalendarGridProps = Record<string, never>;
export type CalendarGridExposes = {};
export type CalendarRowProps = { index?: number };
export type CalendarRowExposes = { hidden: ExposeState<boolean> };
export type CalendarRowAsHookContract = { state: { hidden: State<boolean> } };
export type CalendarHeadingProps = Record<string, never>;
export type CalendarHeadingExposes = {
  month: ExposeState<string>;
  displayValue: ExposeState<string>;
};
export type CalendarHeadingAsHookContract = {
  state: { month: State<string>; displayValue: State<string> };
};
export type CalendarPreviousProps = import('../button').ButtonProps & { a11yLabel?: string };
export type CalendarPreviousExposes = import('../button').ButtonExposes;
export type CalendarNextProps = CalendarPreviousProps;
export type CalendarNextExposes = CalendarPreviousExposes;
export type CalendarNavigationAsHookContract = {
  state: { a11yLabel: State<string> };
  asHooks: { 'as-button': ReturnType<typeof import('../button').asButton> };
};

export type CalendarCaptionProps = { a11yLabel?: string };
export type CalendarCaptionExposes = {};
export type CalendarWeekdaysProps = Record<string, never>;
export type CalendarWeekdaysExposes = {};
export type CalendarWeekdayProps = { offset?: number };
export type CalendarWeekdayExposes = { weekday: ExposeState<number>; label: ExposeState<string> };
export type CalendarWeekdayAsHookContract = {
  state: { weekday: State<number>; label: State<string>; description: State<string> };
};
