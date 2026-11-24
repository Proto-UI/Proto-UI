import { createContextKey } from '@proto.ui/core';
import type { ProgressPartProps, ProgressRootProps } from '@proto.ui/prototypes-base/progress';

export const LIQUID_GLASS_PROGRESS_PROMINENCES = ['regular', 'prominent', 'destructive'] as const;

export type LiquidGlassProgressProminence = (typeof LIQUID_GLASS_PROGRESS_PROMINENCES)[number];
export type LiquidGlassProgressProminenceChoice = LiquidGlassProgressProminence | 'inherit';
export type LiquidGlassProgressDirection = 'ltr' | 'rtl';

export type LiquidGlassProgressRootProps = ProgressRootProps & {
  prominence?: LiquidGlassProgressProminence;
  dir?: LiquidGlassProgressDirection;
};

export type LiquidGlassProgressPartProps = ProgressPartProps & {
  prominence?: LiquidGlassProgressProminenceChoice;
};

export type LiquidGlassProgressContext = {
  prominence: LiquidGlassProgressProminence;
};

export const LIQUID_GLASS_PROGRESS_CONTEXT =
  createContextKey<LiquidGlassProgressContext>('liquid-glass-progress');

export function normalizeLiquidGlassProgressProminence(
  value: unknown
): LiquidGlassProgressProminence | null {
  if (value === undefined || value === null || value === 'inherit') return null;
  if (LIQUID_GLASS_PROGRESS_PROMINENCES.includes(value as LiquidGlassProgressProminence)) {
    return value as LiquidGlassProgressProminence;
  }
  return null;
}
