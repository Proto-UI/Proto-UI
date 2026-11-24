import type { FormActionProps } from '@proto.ui/prototypes-base/form';

export type LiquidGlassFormActionVariant = 'regular' | 'prominent' | 'destructive';

export interface LiquidGlassFormActionProps extends FormActionProps {
  variant?: LiquidGlassFormActionVariant;
  material?: 'auto' | 'opaque';
}
