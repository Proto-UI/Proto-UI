import { createContextKey } from '@proto.ui/core';
import type { ProgressPartProps, ProgressRootProps } from '@proto.ui/prototypes-base/progress';

export const BOOTSTRAP_PROGRESS_VARIANTS = [
  'default',
  'info',
  'success',
  'warning',
  'danger',
] as const;

export type BootstrapProgressVariant = (typeof BOOTSTRAP_PROGRESS_VARIANTS)[number];
export type BootstrapProgressVariantChoice = BootstrapProgressVariant | 'inherit';
export type BootstrapProgressDirection = 'ltr' | 'rtl';

export type BootstrapProgressRootProps = ProgressRootProps & {
  variant?: BootstrapProgressVariant;
  dir?: BootstrapProgressDirection;
};

export type BootstrapProgressPartProps = ProgressPartProps & {
  variant?: BootstrapProgressVariantChoice;
};

export type BootstrapProgressContext = {
  variant: BootstrapProgressVariant;
};

export const BOOTSTRAP_PROGRESS_CONTEXT = createContextKey<BootstrapProgressContext>(
  'bootstrap-2-3-2-progress'
);

export function normalizeBootstrapProgressVariant(value: unknown): BootstrapProgressVariant | null {
  if (value === undefined || value === null || value === 'inherit') return null;
  if (BOOTSTRAP_PROGRESS_VARIANTS.includes(value as BootstrapProgressVariant)) {
    return value as BootstrapProgressVariant;
  }
  return null;
}
