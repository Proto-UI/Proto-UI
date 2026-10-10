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
}
export type CalendarRootExposes = CollectionExposes & {
  value: ExposeState<string>;
  month: ExposeState<string>;
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
  };
};
export type CalendarGridProps = Record<string, never>;
export type CalendarGridExposes = {};
export type CalendarRowProps = Record<string, never>;
export type CalendarRowExposes = {};
export type CalendarHeadingProps = Record<string, never>;
export type CalendarHeadingExposes = { month: ExposeState<string> };
export type CalendarHeadingAsHookContract = { state: { month: State<string> } };
export type CalendarPreviousProps = import('../button').ButtonProps;
export type CalendarPreviousExposes = import('../button').ButtonExposes;
export type CalendarNextProps = CalendarPreviousProps;
export type CalendarNextExposes = CalendarPreviousExposes;
export type CalendarNavigationAsHookContract = {
  asHooks: { 'as-button': ReturnType<typeof import('../button').asButton> };
};
