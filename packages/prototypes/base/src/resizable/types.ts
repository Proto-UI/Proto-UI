import type { ExposeState, ExposeMethod, ExposeEvent, State } from '@proto.ui/core';
export type { ResizableRootProps, ResizablePanelProps } from './index';
export type ResizableHandleProps = Record<string, never>;
export type ResizableRootExposes = {
  value: ExposeState<number>;
  requestValue: ExposeMethod<(next: number, commit?: boolean) => boolean>;
  valueChange: ExposeEvent<{ value: number }>;
  valueCommit: ExposeEvent<{ value: number }>;
};
export type ResizablePanelExposes = { size: ExposeState<number> };
export type ResizableHandleExposes = {
  value: ExposeState<number>;
  focusVisible: ExposeState<boolean>;
  disabled: ExposeState<boolean>;
};
export type ResizableRootAsHookContract = {
  state: { value: State<number>; orientation: State<string> };
};
export type ResizablePanelAsHookContract = { state: { size: State<number> } };
export type ResizableHandleAsHookContract = {
  state: {
    value: State<number>;
    min: State<number>;
    max: State<number>;
    orientation: State<string>;
    disabled: State<boolean>;
    focusVisible: State<boolean>;
  };
};
