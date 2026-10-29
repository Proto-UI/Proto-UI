import type { OverlayRecipes } from '../dialog/style';

/** .cn-alert-dialog-* in all eight retained 3d98900e9b73 style CSS files.
 * New York remains the separately adopted 02cad61166c4c20edbc8a3f71bd720eed4c1f49b
 * apps/v4/registry/new-york-v4/ui/alert-dialog.tsx, not Nova.
 * MIT; see package THIRD_PARTY_NOTICES.md. Media, size=sm and responsive
 * owner-dependent layout remain explicit gaps rather than guessed DOM facts.
 */
export const ALERT_PANEL = {
  vega: 'bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-xl p-6 ring-1 duration-100',
  nova: 'bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-xl p-4 ring-1 duration-100',
  maia: 'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[var(--pui-radius-4xl)] p-6 ring-1 duration-100',
  lyra: 'bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-none p-4 ring-1 duration-100',
  mira: 'bg-popover text-popover-foreground ring-foreground/10 gap-3 rounded-xl p-4 ring-1 duration-100',
  luma: 'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[var(--pui-radius-4xl)] p-6 shadow-xl ring-1 duration-100',
  sera: 'bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-none p-6 shadow-md ring-1 duration-100',
  rhea: 'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[min(var(--pui-radius-4xl),24px)] p-6 shadow-xl ring-1 duration-100',
  'new-york-v4':
    'rounded-lg border border-border bg-background text-foreground shadow-lg p-6 gap-4',
} as const satisfies OverlayRecipes;

export const ALERT_HEADER = {
  vega: 'grid-rows-[auto_1fr] place-items-center gap-1.5 text-center',
  nova: 'grid-rows-[auto_1fr] place-items-center gap-1.5 text-center',
  maia: 'grid-rows-[auto_1fr] place-items-center gap-1.5 text-center',
  lyra: 'grid-rows-[auto_1fr] place-items-center gap-1.5 text-center',
  mira: 'grid-rows-[auto_1fr] place-items-center gap-1 text-center',
  luma: 'grid-rows-[auto_1fr] place-items-center gap-1.5 text-center',
  sera: 'grid-rows-[auto_1fr] place-items-center gap-2 text-center',
  rhea: 'grid-rows-[auto_1fr] place-items-center gap-1.5 text-center',
  'new-york-v4': 'gap-1.5 text-left',
} as const satisfies OverlayRecipes;

export const ALERT_FOOTER = {
  vega: 'gap-2',
  nova: 'gap-2 bg-muted/50 -mx-4 -mb-4 rounded-b-xl border-t border-border p-4',
  maia: 'gap-2',
  lyra: 'gap-2',
  mira: 'gap-2',
  luma: 'gap-2',
  sera: 'gap-2',
  rhea: 'gap-2',
  'new-york-v4': 'gap-2',
} as const satisfies OverlayRecipes;

export const ALERT_TITLE = {
  vega: 'text-lg font-medium',
  nova: 'text-base font-medium',
  maia: 'text-lg font-medium',
  lyra: 'text-sm font-medium',
  mira: 'text-sm font-medium',
  luma: 'text-lg font-medium',
  sera: 'text-lg font-semibold uppercase tracking-wider',
  rhea: 'text-lg font-medium',
  'new-york-v4': 'text-lg font-semibold',
} as const satisfies OverlayRecipes;

export const ALERT_DESCRIPTION = {
  vega: 'text-sm text-muted-foreground text-balance',
  nova: 'text-sm text-muted-foreground text-balance',
  maia: 'text-sm text-muted-foreground text-balance',
  lyra: 'text-xs leading-relaxed text-muted-foreground text-balance',
  mira: 'text-xs leading-relaxed text-muted-foreground text-balance',
  luma: 'text-sm text-muted-foreground text-balance',
  sera: 'text-sm text-muted-foreground text-balance leading-relaxed mt-0.5',
  rhea: 'text-sm text-muted-foreground text-balance',
  'new-york-v4': 'text-sm text-muted-foreground',
} as const satisfies OverlayRecipes;
