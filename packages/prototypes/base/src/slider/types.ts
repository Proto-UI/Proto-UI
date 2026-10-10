import type { ExposeEvent, ExposeMethod, ExposeState, State } from '@proto.ui/core';
export interface SliderRootProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  readOnly?: boolean;
  orientation?: 'horizontal' | 'vertical';
  direction?: 'ltr' | 'rtl';
  ariaLabel?: string;
  valueText?: string;
}
export type SliderStates = {
  value: State<number>;
  percentage: State<number>;
  disabled: State<boolean>;
  readOnly: State<boolean>;
  dragging: State<boolean>;
  orientation: State<string>;
};
export type SliderRootExposes = {
  value: ExposeState<number>;
  percentage: ExposeState<number>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  dragging: ExposeState<boolean>;
  orientation: ExposeState<string>;
  resetValue: ExposeMethod<() => boolean>;
  requestValue: ExposeMethod<(value: number) => boolean>;
  beginInteraction: ExposeMethod<() => boolean>;
  commitValue: ExposeMethod<() => void>;
  cancelInteraction: ExposeMethod<() => void>;
  valueChange: ExposeEvent<{ value: number }>;
  valueCommit: ExposeEvent<{ value: number }>;
};
export type SliderRootAsHookContract = { state: SliderStates };
export interface SliderPartProps {}

/** Read-only facts registered by every Slider part; editing requests remain on Root. */
export type SliderPartExposes = {
  value: ExposeState<number>;
  percentage: ExposeState<number>;
  disabled: ExposeState<boolean>;
  readOnly: ExposeState<boolean>;
  orientation: ExposeState<string>;
  direction: ExposeState<string>;
};
export type SliderThumbExposes = SliderPartExposes & {
  focusVisible: ExposeState<boolean>;
  hovered: ExposeState<boolean>;
  pressed: ExposeState<boolean>;
  focusSelf: ExposeMethod<() => void>;
  resetValue: ExposeMethod<() => boolean>;
  __fieldInput: ExposeMethod<() => void>;
};
export type SliderFieldThumbExposes = SliderThumbExposes & {
  [K in keyof import('../field').FieldControlBindingStates]: ExposeState<boolean>;
};
