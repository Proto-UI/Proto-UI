import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** .cn-alert-dialog-* in all eight retained 3d98900e9b73 style CSS files.
 * New York remains the separately adopted 02cad61166c4c20edbc8a3f71bd720eed4c1f49b
 * apps/v4/registry/new-york-v4/ui/alert-dialog.tsx, not Nova.
 * MIT; see package THIRD_PARTY_NOTICES.md. Media, size=sm and responsive
 * owner-dependent layout remain explicit gaps rather than guessed DOM facts.
 */
export const ALERT_PANEL = {
  vega: tw(
    'bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-xl p-6 ring-1 duration-100'
  ),
  nova: tw(
    'bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-xl p-4 ring-1 duration-100'
  ),
  maia: tw(
    'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[var(--pui-radius-4xl)] p-6 ring-1 duration-100'
  ),
  lyra: tw(
    'bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-none p-4 ring-1 duration-100'
  ),
  mira: tw(
    'bg-popover text-popover-foreground ring-foreground/10 gap-3 rounded-xl p-4 ring-1 duration-100'
  ),
  luma: tw(
    'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[var(--pui-radius-4xl)] p-6 shadow-xl ring-1 duration-100'
  ),
  sera: tw(
    'bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-none p-6 shadow-md ring-1 duration-100'
  ),
  rhea: tw(
    'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[min(var(--pui-radius-4xl),24px)] p-6 shadow-xl ring-1 duration-100'
  ),
  'new-york-v4': tw(
    'rounded-lg border border-border bg-background text-foreground shadow-lg p-6 gap-4'
  ),
} as const satisfies OverlayRecipes;

export const ALERT_HEADER = {
  vega: tw('grid-rows-[auto_1fr] place-items-center gap-1.5 text-center'),
  nova: tw('grid-rows-[auto_1fr] place-items-center gap-1.5 text-center'),
  maia: tw('grid-rows-[auto_1fr] place-items-center gap-1.5 text-center'),
  lyra: tw('grid-rows-[auto_1fr] place-items-center gap-1.5 text-center'),
  mira: tw('grid-rows-[auto_1fr] place-items-center gap-1 text-center'),
  luma: tw('grid-rows-[auto_1fr] place-items-center gap-1.5 text-center'),
  sera: tw('grid-rows-[auto_1fr] place-items-center gap-2 text-center'),
  rhea: tw('grid-rows-[auto_1fr] place-items-center gap-1.5 text-center'),
  'new-york-v4': tw('gap-1.5 text-left'),
} as const satisfies OverlayRecipes;

export const ALERT_FOOTER = {
  vega: tw('gap-2'),
  nova: tw('gap-2 bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t border-border p-4'),
  maia: tw('gap-2'),
  lyra: tw('gap-2'),
  mira: tw('gap-2'),
  luma: tw('gap-2'),
  sera: tw('gap-2'),
  rhea: tw('gap-2'),
  'new-york-v4': tw('gap-2'),
} as const satisfies OverlayRecipes;

export const ALERT_TITLE = {
  vega: tw('text-lg font-medium'),
  nova: tw('text-base font-medium'),
  maia: tw('text-lg font-medium'),
  lyra: tw('text-sm font-medium'),
  mira: tw('text-sm font-medium'),
  luma: tw('text-lg font-medium'),
  sera: tw('text-lg font-semibold uppercase tracking-wider'),
  rhea: tw('text-lg font-medium'),
  'new-york-v4': tw('text-lg font-semibold'),
} as const satisfies OverlayRecipes;

export const ALERT_DESCRIPTION = {
  vega: tw('text-sm text-muted-foreground text-balance'),
  nova: tw('text-sm text-muted-foreground text-balance'),
  maia: tw('text-sm text-muted-foreground text-balance'),
  lyra: tw('text-xs leading-relaxed text-muted-foreground text-balance'),
  mira: tw('text-xs leading-relaxed text-muted-foreground text-balance'),
  luma: tw('text-sm text-muted-foreground text-balance'),
  sera: tw('text-sm text-muted-foreground text-balance leading-relaxed mt-0.5'),
  rhea: tw('text-sm text-muted-foreground text-balance'),
  'new-york-v4': tw('text-sm text-muted-foreground'),
} as const satisfies OverlayRecipes;
