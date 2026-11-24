import type {
  AlertDialogActionProps as BaseActionProps,
  AlertDialogContentProps as BaseContentProps,
  AlertDialogTriggerProps as BaseTriggerProps,
} from '@proto.ui/prototypes-base/alert-dialog';

export type LiquidGlassAlertDialogMaterial = 'auto' | 'opaque';
export type LiquidGlassAlertDialogSize = 'default' | 'sm';
export type LiquidGlassAlertDialogProminence = 'regular' | 'prominent' | 'destructive';

export type LiquidGlassAlertDialogContentProps = BaseContentProps & {
  size?: LiquidGlassAlertDialogSize;
  /** Auto enhances only when live host material preferences and support allow it. */
  material?: LiquidGlassAlertDialogMaterial;
};

export interface LiquidGlassAlertDialogTriggerProps extends BaseTriggerProps {
  variant?: LiquidGlassAlertDialogProminence;
  material?: LiquidGlassAlertDialogMaterial;
}

export interface LiquidGlassAlertDialogActionProps extends BaseActionProps {
  variant?: LiquidGlassAlertDialogProminence;
}
