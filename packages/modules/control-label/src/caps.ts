import { cap, type ControlLabelActivationSource } from '@proto.ui/core';
import type { ControlLabelView } from './registry';
export type ControlLabelHostLease = Readonly<{
  view(): ControlLabelView | null;
  /** Module-owned action projection; never inferred from style or text. */
  setActivation(enabled: boolean): void;
  dispose(): void;
}>;
export type ControlLabelHost = Readonly<{
  attach(options: {
    kind: 'label' | 'target';
    activation: boolean;
    onActivate(source: ControlLabelActivationSource): void;
    onViewChange(): void;
  }): ControlLabelHostLease;
}>;
export const CONTROL_LABEL_HOST_CAP = cap<ControlLabelHost>('@proto.ui/control-label/host');
export const CONTROL_LABEL_RUN_IN_CALLBACK_CAP = cap<(callback: () => void) => void>(
  '@proto.ui/control-label/run-in-callback'
);
