import type { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';

export type SliderValuesValue = number | readonly number[];
export type SliderValuesShape = 'scalar' | 'array';
export interface SliderValuesRootProps {
  value?: SliderValuesValue;
  defaultValue?: SliderValuesValue;
  min?: number;
  max?: number;
  step?: number;
  largeStep?: number;
  minStepsBetweenValues?: number;
  disabled?: boolean;
  readOnly?: boolean;
  orientation?: 'horizontal' | 'vertical';
  direction?: 'ltr' | 'rtl';
  ariaLabel?: string;
}
export type SliderValuesEvent = {
  value: SliderValuesValue;
  activeThumbIndex: number;
  reason: string;
};
export type SliderValuesRootExposes = {
  values: ExposeState<readonly number[]>;
  valueShape: ExposeState<string>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  ready: ExposeState<boolean>;
  phase: ExposeState<string>;
  diagnostic: ExposeState<string>;
  activeIndex: ExposeState<number>;
  interacting: ExposeState<boolean>;
  getValue: ExposeMethod<() => SliderValuesValue | null>;
  getDisplayValue: ExposeMethod<() => SliderValuesValue | null>;
  requestValue: ExposeMethod<(value: number) => boolean>;
  requestValues: ExposeMethod<(values: readonly number[]) => boolean>;
  requestThumbValue: ExposeMethod<(index: number, value: number) => boolean>;
  requestKeyboardValue: ExposeMethod<(index: number, key: string, shift?: boolean) => boolean>;
  beginInteraction: ExposeMethod<(index?: number) => boolean>;
  commitValue: ExposeMethod<() => boolean>;
  cancelInteraction: ExposeMethod<() => boolean>;
  cancelValueChange: ExposeMethod<() => boolean>;
  resetValue: ExposeMethod<() => boolean>;
  invalidateParts: ExposeMethod<() => void>;
  valueChange: ExposeEvent<SliderValuesEvent>;
  valueCommit: ExposeEvent<SliderValuesEvent>;
};
export type SliderValuesRootAsHookContract = {
  state: {
    values: State<readonly number[]>;
    valueShape: State<string>;
    disabled: State<boolean>;
    readOnly: State<boolean>;
    ready: State<boolean>;
    phase: State<string>;
    diagnostic: State<string>;
    activeIndex: State<number>;
    interacting: State<boolean>;
  };
};
export interface SliderValuesPartProps {
  index?: number;
  startIndex?: number;
  endIndex?: number;
  disabled?: boolean;
  readOnly?: boolean;
  ariaLabel?: string;
  valueText?: string;
}
export type SliderValuesPartStates = {
  value: State<number>;
  percentage: State<number>;
  startPercentage: State<number>;
  endPercentage: State<number>;
  extent: State<number>;
  index: State<number>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
  orientation: State<string>;
  direction: State<string>;
};
export type SliderValuesPartExposes = {
  [K in keyof SliderValuesPartStates]: SliderValuesPartStates[K] extends State<infer V>
    ? ExposeState<V>
    : never;
};
export type SliderValuesThumbExposes = SliderValuesPartExposes & {
  focusVisible: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  focusSelf: ExposeMethod<() => void>;
  getSlotInfo: ExposeMethod<() => { index: number; disabled: boolean; readOnly: boolean }>;
};
export type SliderValuesThumbAsHookContract = {
  state: SliderValuesPartStates & { focusVisible: State<boolean>; hovered: State<boolean> };
};
