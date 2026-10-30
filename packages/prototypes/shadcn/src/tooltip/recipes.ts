import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** Modern .cn-tooltip-content and bases/base/ui/tooltip.tsx at 3d98900e9b73.
 * Independent New York stays f31ed81983653919dd4fe77aee4b4859f610f1dc.
 * The no-selection compatibility default is still the separate 2026-10-10
 * content-hash-pinned base-nova snapshot (THIRD_PARTY_NOTICES.md), not New York.
 * max-w-80 is the existing lawful 20rem lowering of upstream max-w-xs.
 * Arrow, transform-origin and kbd descendant paint remain unimplemented.
 * MIT Copyright (c) 2023 shadcn; see THIRD_PARTY_NOTICES.md.
 */
export const TOOLTIP_PANEL = {
  vega: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md'),
  nova: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md'),
  maia: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-[var(--pui-radius-2xl)]'),
  lyra: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-none'),
  mira: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md'),
  luma: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-xl'),
  sera: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-none'),
  rhea: tw('inline-flex w-fit max-w-80 items-center gap-1.5 rounded-xl'),
  'new-york-v4': tw('w-fit rounded-md text-balance'),
} as const satisfies OverlayRecipes;
