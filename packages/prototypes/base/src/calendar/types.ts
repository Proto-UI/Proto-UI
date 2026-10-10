import type {
  ExposeEvent,
  ExposeMethod,
  ExposeState,
  State,
  FocusRequestOptions,
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
export type CalendarRootExposes = {
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
export type CalendarDayExposes = {
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
    date: State<string>;
    selected: State<boolean>;
    disabled: State<boolean>;
    outside: State<boolean>;
    focused: State<boolean>;
    focusVisible: State<boolean>;
  };
};
