import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** .cn-hover-card-content at shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * paired with bases/base/ui/hover-card.tsx. New York remains independently
 * pinned f31ed81983653919dd4fe77aee4b4859f610f1dc new-york-v4/ui/hover-card.tsx.
 * MIT; see THIRD_PARTY_NOTICES.md. New York inherits font size and line height;
 * it does not acquire the modern styles' explicit small typography.
 */
export const HOVER_CARD_PANEL = {
  vega: tw(
    'ring-foreground/10 bg-popover text-popover-foreground w-64 rounded-lg p-4 text-sm shadow-md ring-1 duration-100'
  ),
  nova: tw(
    'ring-foreground/10 bg-popover text-popover-foreground w-64 rounded-lg p-2.5 text-sm shadow-md ring-1 duration-100'
  ),
  maia: tw(
    'ring-foreground/5 bg-popover text-popover-foreground w-72 rounded-[var(--pui-radius-2xl)] p-4 text-sm shadow-2xl ring-1 duration-100'
  ),
  lyra: tw(
    'ring-foreground/10 bg-popover text-popover-foreground w-64 rounded-none p-2.5 text-xs leading-relaxed shadow-md ring-1 duration-100'
  ),
  mira: tw(
    'ring-foreground/10 bg-popover text-popover-foreground w-72 rounded-lg p-2.5 text-xs leading-relaxed shadow-md ring-1 duration-100'
  ),
  luma: tw(
    'ring-foreground/5 bg-popover text-popover-foreground w-72 rounded-[var(--pui-radius-3xl)] p-4 text-sm shadow-lg ring-1 duration-100'
  ),
  sera: tw(
    'ring-foreground/10 bg-popover text-popover-foreground w-72 p-4 text-sm shadow-md ring-1 duration-100'
  ),
  rhea: tw(
    'ring-foreground/5 bg-popover text-popover-foreground w-72 rounded-[var(--pui-radius-3xl)] p-4 text-sm shadow-lg ring-1 duration-100'
  ),
  // Existing Proto transition-none/200ms projection is retained separately
  // from the pinned upstream's content paint and inherited typography.
  'new-york-v4': tw(
    'w-64 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md transition-none duration-200'
  ),
} as const satisfies OverlayRecipes;
