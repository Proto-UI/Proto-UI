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
  requestValue: ExposeMethod<(value: number) => boolean>;
  beginInteraction: ExposeMethod<() => boolean>;
  commitValue: ExposeMethod<() => void>;
  cancelInteraction: ExposeMethod<() => void>;
  valueChange: ExposeEvent<{ value: number }>;
  valueCommit: ExposeEvent<{ value: number }>;
};
export type SliderRootAsHookContract = { state: SliderStates };
export interface SliderPartProps {}
