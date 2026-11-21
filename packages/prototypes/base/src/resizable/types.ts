import type {
  ObservedStateHandle,
  ExposeState,
  ExposeMethod,
  ExposeEvent,
  State,
} from '@proto.ui/core';
export type { ResizableRootProps, ResizablePanelProps } from './index';
export type ResizableHandleProps = { index?: number };
export type ResizableRootExposes = {
  value: ExposeState<number>;
  sizes: ExposeState<readonly number[]>;
  requestValue: ExposeMethod<(next: number, commit?: boolean) => boolean>;
  requestResize: ExposeMethod<(index: number, next: number, commit?: boolean) => boolean>;
  requestSizes: ExposeMethod<(next: readonly number[], commit?: boolean) => boolean>;
  cancelResize: ExposeMethod<() => boolean>;
  sizesChange: ExposeEvent<{ sizes: readonly number[] }>;
  sizesCommit: ExposeEvent<{ sizes: readonly number[] }>;
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
  state: {
    value: State<number>;
    sizes: State<readonly number[]>;
    orientation: State<string>;
    direction: State<string>;
  };
};
export type ResizablePanelAsHookContract = { state: { size: State<number> } };
export type ResizableHandleAsHookContract = {
  state: {
    value: State<number>;
    min: State<number>;
    max: State<number>;
    orientation: State<string>;
    disabled: State<boolean>;
    focusVisible: ObservedStateHandle<boolean, ResizableHandleProps>;
  };
};
