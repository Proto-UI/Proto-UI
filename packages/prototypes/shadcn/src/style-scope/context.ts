import { createContextKey } from '@proto.ui/core';

/** P-SHADCN-STYLE-SCOPE: draft selection transport, not style parity. */
export const SHADCN_STYLE_IDS = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'rhea',
  'new-york-v4',
] as const;
export type ShadcnStyleId = (typeof SHADCN_STYLE_IDS)[number];
export type ShadcnStyleChoice = ShadcnStyleId | 'new-york' | 'inherit';
export type ShadcnStyleProps = { styleProfile?: ShadcnStyleChoice };
export type ShadcnStyleContext = { style: ShadcnStyleId | null };

/** Identity is this singleton reference, never the diagnostic name. */
export const SHADCN_STYLE_SCOPE = createContextKey<ShadcnStyleContext>('shadcn-style-scope');

export function normalizeShadcnStyle(value: unknown): ShadcnStyleId | null {
  if (value === undefined || value === null || value === 'inherit') return null;
  if (value === 'new-york') return 'new-york-v4';
  if (SHADCN_STYLE_IDS.includes(value as ShadcnStyleId)) return value as ShadcnStyleId;
  throw new Error(`[shadcn-style-scope] Unknown style: ${String(value)}`);
}
