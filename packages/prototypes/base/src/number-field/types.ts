import type { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';
export type NumberFieldFormatOptions = Omit<
  Pick<
    Intl.NumberFormatOptions,
    | 'style'
    | 'currency'
    | 'currencyDisplay'
    | 'currencySign'
    | 'useGrouping'
    | 'minimumIntegerDigits'
    | 'minimumFractionDigits'
    | 'maximumFractionDigits'
    | 'minimumSignificantDigits'
    | 'maximumSignificantDigits'
    | 'signDisplay'
  >,
  'style'
> & { style?: 'decimal' | 'currency' | 'percent' };
export interface NumberFieldRootProps {
  value?: number | null;
  defaultValue?: number | null;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  ariaLabel?: string;
  name?: string;
  /** Allow an empty editor draft to commit null; explicit null props are always supported. */
  allowEmpty?: boolean;
  locale?: string;
  formatOptions?: NumberFieldFormatOptions;
  /** Opt in to dragging the Label to adjust the value. */
  scrub?: boolean;
  /** Number of steps per initial Label width (dimensionless, not host pixels). */
  scrubSteps?: number;
  direction?: 'ltr' | 'rtl';
}
export type NumberFieldRootExposes = {
  /** Numeric readout; consult empty or getValue() when nullable values are used. */
  value: ExposeState<number>;
  empty: ExposeState<boolean>;
  dragging: ExposeState<boolean>;
  formatInvalid: ExposeState<boolean>;
  draft: ExposeState<string>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  resetValue: ExposeMethod<() => boolean>;
  getValue: ExposeMethod<() => number | null>;
  requestValue: ExposeMethod<(value: number | null) => boolean>;
  requestInput: ExposeMethod<(text: string, composing?: boolean) => boolean>;
  commitValue: ExposeMethod<() => void>;
  stepBy: ExposeMethod<(direction: number) => boolean>;
  beginScrub: ExposeMethod<() => boolean>;
  scrubBy: ExposeMethod<(totalDelta: number) => boolean>;
  endScrub: ExposeMethod<() => boolean>;
  cancelScrub: ExposeMethod<() => boolean>;
  valueChange: ExposeEvent<{ value: number | null }>;
  valueCommit: ExposeEvent<{ value: number | null }>;
};
export type NumberFieldRootAsHookContract = {
  state: {
    value: State<number>;
    empty: State<boolean>;
    dragging: State<boolean>;
    formatInvalid: State<boolean>;
    draft: State<string>;
    disabled: State<boolean>;
    readOnly: State<boolean>;
  };
};
export interface NumberFieldPartProps {}

export type NumberFieldInputExposes = {
  value: ExposeState<number>;
  empty: ExposeState<boolean>;
  getValue: ExposeMethod<() => number | null>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  focused: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
  focusSelf: ExposeMethod<() => void>;
  resetValue: ExposeMethod<() => boolean>;
  __fieldInput: ExposeMethod<() => void>;
  __implicitSubmitEligible: ExposeMethod<() => boolean>;
};
export type NumberFieldControlExposes = NumberFieldInputExposes & {
  [K in keyof import('../field').FieldControlBindingStates]: ExposeState<boolean>;
};
export type NumberFieldStepExposes = {
  disabled: ExposeState<boolean>;
  focusVisible: ExposeState<boolean>;
};
export type NumberFieldLabelExposes = {};
