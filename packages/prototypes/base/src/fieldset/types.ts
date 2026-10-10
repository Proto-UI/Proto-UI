import type { ExposeState, State } from '@proto.ui/core';
export interface FieldsetRootProps {
  disabled?: boolean;
  ariaLabel?: string;
}
export interface FieldsetPartProps {}
export type FieldsetRootExposes = { disabled: ExposeState<boolean> };
export type FieldsetAsHookContract = { state: { disabled: State<boolean> } };
