import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7 .cn-popover-* and
 * bases/base/ui/popover.tsx, plus independent new-york-v4/ui/popover.tsx.
 * Existing compatibility default stays Base/Nova: c2a67849be260701852b0977ba15eb5f3a0ce2a4
 * for Title/command geometry, not a retroactively renamed New York baseline.
 * MIT; see THIRD_PARTY_NOTICES.md. No new Header, Anchor, size or Button owner.
 */
export const POPOVER_PANEL = {
  vega: tw(
    'bg-popover text-popover-foreground ring-foreground/10 flex flex-col gap-4 rounded-md p-4 text-sm shadow-md ring-1 duration-100'
  ),
  nova: tw(
    'bg-popover text-popover-foreground ring-foreground/10 flex flex-col gap-2.5 rounded-lg p-2.5 text-sm shadow-md ring-1 duration-100'
  ),
  maia: tw(
    'bg-popover text-popover-foreground ring-foreground/5 flex flex-col gap-4 rounded-[var(--pui-radius-2xl)] p-4 text-sm shadow-2xl ring-1 duration-100'
  ),
  lyra: tw(
    'bg-popover text-popover-foreground ring-foreground/10 flex flex-col gap-2.5 rounded-none p-2.5 text-xs shadow-md ring-1 duration-100'
  ),
  mira: tw(
    'bg-popover text-popover-foreground ring-foreground/10 flex flex-col gap-4 rounded-lg p-2.5 text-xs shadow-md ring-1 duration-100'
  ),
  luma: tw(
    'bg-popover text-popover-foreground ring-foreground/5 flex flex-col gap-4 rounded-[var(--pui-radius-3xl)] p-4 text-sm shadow-lg ring-1 duration-100'
  ),
  sera: tw(
    'bg-popover text-popover-foreground ring-foreground/10 flex flex-col gap-4 rounded-none p-4 text-sm shadow-md ring-1 duration-100'
  ),
  rhea: tw(
    'bg-popover text-popover-foreground ring-foreground/5 flex flex-col gap-4 rounded-[var(--pui-radius-3xl)] p-4 text-sm shadow-lg ring-1 duration-100'
  ),
  'new-york-v4': tw(
    'rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md'
  ),
} as const satisfies OverlayRecipes;

export const POPOVER_TITLE = {
  vega: tw('font-medium'),
  nova: tw('font-medium'),
  maia: tw('text-base font-medium'),
  lyra: tw('text-sm font-medium'),
  mira: tw('text-sm font-medium'),
  luma: tw('text-base font-medium'),
  sera: tw('text-xs font-semibold uppercase'),
  rhea: tw('text-base font-medium'),
  'new-york-v4': tw('font-medium'),
} as const satisfies OverlayRecipes;

export const POPOVER_DESCRIPTION = {
  vega: tw('text-muted-foreground'),
  nova: tw('text-muted-foreground'),
  maia: tw('text-muted-foreground'),
  lyra: tw('text-muted-foreground text-xs leading-relaxed'),
  mira: tw('text-muted-foreground'),
  luma: tw('text-muted-foreground'),
  sera: tw('text-muted-foreground text-sm leading-relaxed mt-0.5'),
  rhea: tw('text-muted-foreground'),
  'new-york-v4': tw('text-muted-foreground'),
} as const satisfies OverlayRecipes;
