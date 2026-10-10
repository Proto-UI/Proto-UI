import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
  FocusRequestOptions,
  CollectionExposes,
  CollectionItemExposes,
} from '@proto.ui/core';
export interface CalendarRootProps {
  value?: string;
  defaultValue?: string;
  month?: string;
  defaultMonth?: string;
  min?: string;
  max?: string;
  unavailable?: readonly string[];
  disabled?: boolean;
  readOnly?: boolean;
  weekStartsOn?: number;
  a11yLabel?: string;
  /** Civil date supplied by the host clock; omitted means no today marker. */
  today?: string;
  locale?: string;
  direction?: 'ltr' | 'rtl';
}
export type CalendarRootExposes = CollectionExposes & {
  value: ExposeState<string>;
  month: ExposeState<string>;
  disabled: ExposeState<boolean>;
  direction: ExposeState<string>;
  valueChange: ExposeEvent<{ value: string }>;
  monthChange: ExposeEvent<{ month: string }>;
  requestValue: ExposeMethod<(value: string) => boolean>;
  requestMonth: ExposeMethod<(month: string) => boolean>;
};
export interface CalendarDayProps {
  date?: string;
  offset?: number;
  disabled?: boolean;
}
export type CalendarDayExposes = CollectionItemExposes & {
  date: ExposeState<string>;
  selected: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
  outside: ExposeState<boolean>;
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
    disabled: State<boolean>;
    outside: State<boolean>;
    today: State<boolean>;
    hovered: State<boolean>;
    pressed: State<boolean>;
    dateLabel: State<string>;
    current: State<string>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};

export type CalendarRootAsHookContract = {
  state: {
    collectionCount: State<number>;
    value: State<string>;
    month: State<string>;
    a11yLabel: State<string>;
    disabled: State<boolean>;
    direction: State<string>;
  };
};
export type CalendarGridProps = Record<string, never>;
export type CalendarGridExposes = {};
export type CalendarRowProps = Record<string, never>;
export type CalendarRowExposes = {};
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
