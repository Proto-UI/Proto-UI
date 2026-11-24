import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** Style-profile surface and control recipes for Shadcn Toast parts.
 * Normal surface colors bind to popover/popover-foreground/border when a style
 * profile is selected, preserving the unpinned background/foreground fallback.
 * MIT; see THIRD_PARTY_NOTICES.md.
 */
export const TOAST_RADIUS = {
  vega: tw('rounded-[var(--pui-radius-2xl)]'),
  nova: tw('rounded-[var(--pui-radius-2xl)]'),
  maia: tw('rounded-[var(--pui-radius-2xl)]'),
  lyra: tw('rounded-none'),
  mira: tw('rounded-md'),
  luma: tw('rounded-[var(--pui-radius-2xl)]'),
  sera: tw('rounded-none'),
  rhea: tw('rounded-[var(--pui-radius-2xl)]'),
  'new-york-v4': tw('rounded-base'),
} as const satisfies OverlayRecipes;

export const TOAST_ROOT_RECIPES = {
  vega: tw('text-sm'),
  nova: tw('text-sm'),
  maia: tw('text-sm ring-1 ring-foreground/5'),
  lyra: tw('text-xs'),
  mira: tw('text-xs'),
  luma: tw('text-sm ring-1 ring-foreground/5'),
  sera: tw('text-sm'),
  rhea: tw('text-sm ring-1 ring-foreground/5'),
  'new-york-v4': tw('text-sm'),
} as const satisfies OverlayRecipes;

export const TOAST_TITLE_RECIPES = {
  vega: tw('text-sm font-semibold leading-5 tracking-tight'),
  nova: tw('text-sm font-semibold leading-5 tracking-tight'),
  maia: tw('text-sm font-semibold leading-5 tracking-tight'),
  lyra: tw('text-xs font-semibold leading-4 tracking-tight'),
  mira: tw('text-xs font-semibold leading-4 tracking-tight'),
  luma: tw('text-sm font-semibold leading-5 tracking-tight'),
  sera: tw('text-sm font-semibold leading-5 tracking-tight'),
  rhea: tw('text-sm font-semibold leading-5 tracking-tight'),
  'new-york-v4': tw('text-sm font-semibold leading-5 tracking-tight'),
} as const satisfies OverlayRecipes;

export const TOAST_DESCRIPTION_RECIPES = {
  vega: tw('text-sm leading-5 text-muted-foreground'),
  nova: tw('text-sm leading-5 text-muted-foreground'),
  maia: tw('text-sm leading-5 text-muted-foreground'),
  lyra: tw('text-xs leading-4 text-muted-foreground'),
  mira: tw('text-xs leading-4 text-muted-foreground'),
  luma: tw('text-sm leading-5 text-muted-foreground'),
  sera: tw('text-sm leading-5 text-muted-foreground'),
  rhea: tw('text-sm leading-5 text-muted-foreground'),
  'new-york-v4': tw('text-sm leading-5 text-muted-foreground'),
} as const satisfies OverlayRecipes;

export const TOAST_ACTION_RECIPES = {
  vega: tw(
    'rounded-md h-7 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  nova: tw(
    'rounded-md h-7 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  maia: tw(
    'rounded-lg h-7 px-3 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  lyra: tw(
    'rounded-none h-7 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  mira: tw(
    'rounded-md h-7 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  luma: tw(
    'rounded-lg h-7 px-3 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  sera: tw(
    'rounded-none h-7 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  rhea: tw(
    'rounded-lg h-7 px-3 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
  'new-york-v4': tw(
    'rounded-md h-7 px-2.5 text-xs font-medium bg-primary text-primary-foreground border border-transparent hover:bg-primary/90'
  ),
} as const satisfies OverlayRecipes;

export const TOAST_CLOSE_RECIPES = {
  vega: tw(
    'rounded-md h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  nova: tw(
    'rounded-md h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  maia: tw(
    'rounded-lg h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  lyra: tw(
    'rounded-none h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  mira: tw(
    'rounded-md h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  luma: tw(
    'rounded-lg h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  sera: tw(
    'rounded-none h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  rhea: tw(
    'rounded-lg h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
  'new-york-v4': tw(
    'rounded-md h-7 px-2.5 text-xs font-medium border border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-accent-foreground'
  ),
} as const satisfies OverlayRecipes;
