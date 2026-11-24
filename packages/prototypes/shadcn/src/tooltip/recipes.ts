import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** Modern .cn-tooltip-content and bases/base/ui/tooltip.tsx recipes.
 * The no-selection compatibility default stays on base-nova; New York v4 uses
 * bg-primary / text-primary-foreground while modern presets use bg-foreground /
 * text-background. max-w-80 is the lawful 20rem lowering of upstream max-w-xs.
 * MIT Copyright (c) 2023 shadcn; see THIRD_PARTY_NOTICES.md.
 */
export const TOOLTIP_PANEL = {
  vega: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md bg-foreground text-background text-balance'
  ),
  nova: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md bg-foreground text-background text-balance'
  ),
  maia: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-[var(--pui-radius-2xl)] bg-foreground text-background text-balance'
  ),
  lyra: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-none bg-foreground text-background text-balance'
  ),
  mira: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md bg-foreground text-background text-balance'
  ),
  luma: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-xl bg-foreground text-background text-balance'
  ),
  sera: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-none bg-foreground text-background text-balance'
  ),
  rhea: tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-xl bg-foreground text-background text-balance'
  ),
  'new-york-v4': tw(
    'inline-flex w-fit max-w-80 items-center gap-1.5 rounded-md bg-primary text-primary-foreground text-balance'
  ),
} as const satisfies OverlayRecipes;
