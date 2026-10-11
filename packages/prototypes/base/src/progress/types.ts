import type { ExposeState, State } from '@proto.ui/core';
export interface ProgressRootProps {
  value?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
  valueText?: string;
  indeterminate?: boolean;
}
export type ProgressStates = {
  value: State<number>;
  percentage: State<number>;
  indeterminate: State<boolean>;
  status: State<string>;
};
export type ProgressRootExposes = {
  [K in keyof ProgressStates]: ExposeState<ProgressStates[K] extends State<infer V> ? V : never>;
};
export type ProgressRootAsHookContract = { state: ProgressStates };
export interface ProgressPartProps {}
export type ProgressPartExposes = ProgressRootExposes;
