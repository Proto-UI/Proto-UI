import type {
  AlertDialogActionProps as BaseActionProps,
  AlertDialogContentProps as BaseContentProps,
  AlertDialogTriggerProps as BaseTriggerProps,
} from '@proto.ui/prototypes-base/alert-dialog';

export type BootstrapAlertDialogButtonVariant =
  | 'default'
  | 'primary'
  | 'warning'
  | 'danger'
  | 'success'
  | 'info'
  | 'inverse';

export type BootstrapAlertDialogSize = 'default' | 'sm';

export type BootstrapAlertDialogContentProps = BaseContentProps & {
  size?: BootstrapAlertDialogSize;
};

export interface BootstrapAlertDialogTriggerProps extends BaseTriggerProps {
  variant?: BootstrapAlertDialogButtonVariant;
}

export interface BootstrapAlertDialogActionProps extends BaseActionProps {
  variant?: BootstrapAlertDialogButtonVariant;
}
