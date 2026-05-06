import type { ExposeEvent, ExposeState, State } from '@proto.ui/core';

export interface SliderRootProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

export type SliderRootExposes = {
  value: ExposeState<number>;
  min: ExposeState<number>;
  max: ExposeState<number>;
  step: ExposeState<number>;
  disabled: ExposeState<boolean>;
  orientation: ExposeState<string>;
  valueChange: ExposeEvent<{ value: number }>;
};

export type SliderRootStateHandles = {
  value: State<number>;
  disabled: State<boolean>;
};

export type SliderRootAsHookContract = {
  state: SliderRootStateHandles;
  event: {
    valueChange: { value: number };
  };
};
