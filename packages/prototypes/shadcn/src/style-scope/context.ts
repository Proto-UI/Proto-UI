import { createContextKey } from '@proto.ui/core';
import { SHADCN_STYLE_IDS, type ShadcnStyleId } from './ids';

export { SHADCN_STYLE_IDS, type ShadcnStyleId } from './ids';
export type ShadcnStyleChoice = ShadcnStyleId | 'new-york' | 'inherit';
export type ShadcnStyleProps = { styleProfile?: ShadcnStyleChoice };
export type ShadcnStyleContext = { style: ShadcnStyleId | null };

/** Identity is this singleton reference, never the diagnostic name. */
export const SHADCN_STYLE_SCOPE = createContextKey<ShadcnStyleContext>('shadcn-style-scope');

export function normalizeShadcnStyle(value: unknown): ShadcnStyleId | null {
  if (value === undefined || value === null || value === 'inherit') return null;
  if (value === 'new-york') return 'new-york-v4';
  // Keep the shared Rule iteration domain out of the method receiver's lifetime.
  // Membership inspects a private value copy; the exported array keeps its identity.
  if ([...SHADCN_STYLE_IDS].includes(value as ShadcnStyleId)) return value as ShadcnStyleId;
  throw new Error(`[shadcn-style-scope] Unknown style: ${String(value)}`);
}
