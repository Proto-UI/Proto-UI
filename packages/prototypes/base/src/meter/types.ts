import type { ExposeState, State } from '@proto.ui/core';
export interface MeterRootProps {
  value?: number;
  min?: number;
  max?: number;
  ariaLabel?: string;
  valueText?: string;
  low?: number;
  high?: number;
  optimum?: number;
}
export type MeterStates = {
  value: State<number>;
  percentage: State<number>;
  indeterminate: State<boolean>;
  status: State<string>;
};
export type MeterRootExposes = {
  [K in keyof MeterStates]: ExposeState<MeterStates[K] extends State<infer V> ? V : never>;
};
export type MeterRootAsHookContract = { state: MeterStates };
export interface MeterPartProps {}
export type MeterPartExposes = MeterRootExposes;
