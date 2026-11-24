import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** Style-profile surface and control recipes for Shadcn Toast parts.
 * Normal surface colors bind to popover/popover-foreground/border when a style
 * profile is selected, preserving the unpinned background/foreground fallback.
 * MIT; see THIRD_PARTY_NOTICES.md.
 */
export const TOAST_RADIUS = {
  vega: tw('rounded-lg'),
  nova: tw('rounded-lg'),
  maia: tw('rounded-xl'),
  lyra: tw('rounded-none'),
  mira: tw('rounded-md'),
  luma: tw('rounded-xl'),
  sera: tw('rounded-none'),
  rhea: tw('rounded-xl'),
  'new-york-v4': tw('rounded-lg'),
} as const satisfies OverlayRecipes;

export const TOAST_ROOT_RECIPES = {
  vega: tw('text-[13px]'),
  nova: tw('text-[13px]'),
  maia: tw('text-[13px] ring-1 ring-foreground/5'),
  lyra: tw('text-xs'),
  mira: tw('text-xs'),
  luma: tw('text-[13px] ring-1 ring-foreground/5'),
  sera: tw('text-[13px]'),
  rhea: tw('text-[13px] ring-1 ring-foreground/5'),
  'new-york-v4': tw('text-[13px]'),
} as const satisfies OverlayRecipes;

export const TOAST_TITLE_RECIPES = {
  vega: tw('text-[13px] font-medium leading-5 tracking-tight'),
  nova: tw('text-[13px] font-medium leading-5 tracking-tight'),
  maia: tw('text-[13px] font-medium leading-5 tracking-tight'),
  lyra: tw('text-xs font-medium leading-4 tracking-tight'),
  mira: tw('text-xs font-medium leading-4 tracking-tight'),
  luma: tw('text-[13px] font-medium leading-5 tracking-tight'),
  sera: tw('text-[13px] font-medium leading-5 tracking-tight'),
  rhea: tw('text-[13px] font-medium leading-5 tracking-tight'),
  'new-york-v4': tw('text-[13px] font-medium leading-5 tracking-tight'),
} as const satisfies OverlayRecipes;

export const TOAST_DESCRIPTION_RECIPES = {
  vega: tw('text-[13px] leading-[1.4] text-muted-foreground'),
  nova: tw('text-[13px] leading-[1.4] text-muted-foreground'),
  maia: tw('text-[13px] leading-[1.4] text-muted-foreground'),
  lyra: tw('text-xs leading-4 text-muted-foreground'),
  mira: tw('text-xs leading-4 text-muted-foreground'),
  luma: tw('text-[13px] leading-[1.4] text-muted-foreground'),
  sera: tw('text-[13px] leading-[1.4] text-muted-foreground'),
  rhea: tw('text-[13px] leading-[1.4] text-muted-foreground'),
  'new-york-v4': tw('text-[13px] leading-[1.4] text-muted-foreground'),
} as const satisfies OverlayRecipes;

export const TOAST_ACTION_RECIPES = {
  vega: tw(
    'rounded-md h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  nova: tw(
    'rounded-md h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  maia: tw(
    'rounded-md h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  lyra: tw(
    'rounded-none h-6 px-2 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  mira: tw(
    'rounded-md h-6 px-2 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  luma: tw(
    'rounded-md h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  sera: tw(
    'rounded-none h-6 px-2 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  rhea: tw(
    'rounded-md h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
  'new-york-v4': tw(
    'rounded-md h-6 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent'
  ),
} as const satisfies OverlayRecipes;

export const TOAST_CLOSE_RECIPES = {
  vega: tw(
    'rounded-md h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  nova: tw(
    'rounded-md h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  maia: tw(
    'rounded-md h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  lyra: tw(
    'rounded-none h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  mira: tw(
    'rounded-md h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  luma: tw(
    'rounded-md h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  sera: tw(
    'rounded-none h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  rhea: tw(
    'rounded-md h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
  'new-york-v4': tw(
    'rounded-md h-6 px-2 text-xs font-medium border border-border bg-transparent text-muted-foreground'
  ),
} as const satisfies OverlayRecipes;
