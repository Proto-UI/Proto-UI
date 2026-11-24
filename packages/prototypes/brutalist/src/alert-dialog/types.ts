import type { AlertDialogContentProps as BaseContentProps } from '@proto.ui/prototypes-base/alert-dialog';

export type BrutalistAlertDialogSize = 'default' | 'sm';

export type BrutalistAlertDialogContentProps = BaseContentProps & {
  size?: BrutalistAlertDialogSize;
};

// Passive presentation parts have no configuration, events or exposed state.
export interface BrutalistAlertDialogHeaderProps {}
export interface BrutalistAlertDialogHeaderExposes {}
export interface BrutalistAlertDialogFooterProps {}
export interface BrutalistAlertDialogFooterExposes {}
