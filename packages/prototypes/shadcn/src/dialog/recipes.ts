import type { OverlayRecipes } from './style';

/** Modern .cn-dialog-* at 3d98900e9b73c45f035f8109e9d41ba6a51685e7.
 * Independent New York: f31ed81983653919dd4fe77aee4b4859f610f1dc,
 * apps/v4/registry/new-york-v4/ui/dialog.tsx. MIT; see THIRD_PARTY_NOTICES.md.
 * Width caps are bounded available-region projections, not sm-breakpoint parity.
 */
export const DIALOG_PANEL = {
  vega: 'bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-xl p-6 text-sm ring-1 duration-100 max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  nova: 'bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-xl p-4 text-sm ring-1 duration-100 max-w-[min(24rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  maia: 'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[var(--pui-radius-4xl)] p-6 text-sm ring-1 duration-100 max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  lyra: 'bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-none p-4 text-xs leading-relaxed ring-1 duration-100 max-w-[min(24rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  mira: 'bg-popover text-popover-foreground ring-foreground/10 gap-4 rounded-xl p-4 text-xs leading-relaxed ring-1 duration-100 max-w-[min(24rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  luma: 'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[var(--pui-radius-4xl)] p-6 text-sm shadow-xl ring-1 duration-100 max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  sera: 'bg-popover text-popover-foreground ring-foreground/10 gap-6 rounded-none p-6 text-sm shadow-md ring-1 duration-100 max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  rhea: 'bg-popover text-popover-foreground ring-foreground/5 gap-6 rounded-[min(var(--pui-radius-4xl),24px)] p-6 text-sm shadow-xl ring-1 duration-100 max-w-[min(28rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
  'new-york-v4':
    'gap-4 rounded-lg border border-border bg-background p-6 shadow-lg duration-200 max-w-[min(32rem,calc(var(--proto-ui-available-region-width,100%)_-_2rem))]',
} as const satisfies OverlayRecipes;

export const DIALOG_HEADER = {
  vega: 'gap-2',
  nova: 'gap-2',
  maia: 'gap-2',
  lyra: 'gap-1 text-left',
  mira: 'gap-1',
  luma: 'gap-1.5',
  sera: 'gap-2',
  rhea: 'gap-1.5',
  'new-york-v4': 'gap-2 text-left',
} as const satisfies OverlayRecipes;

export const DIALOG_FOOTER = {
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

export const DIALOG_TITLE = {
  vega: 'leading-none font-medium',
  nova: 'text-base leading-none font-medium',
  maia: 'text-base leading-none font-medium',
  lyra: 'text-sm font-medium',
  mira: 'text-sm font-medium',
  luma: 'text-base leading-none font-medium',
  sera: 'text-lg font-semibold leading-none uppercase tracking-wider',
  rhea: 'text-base leading-none font-medium',
  'new-york-v4': 'text-lg leading-none font-semibold',
} as const satisfies OverlayRecipes;

// Descendant link selectors require authored link targets; they are not root text paint.
export const DIALOG_DESCRIPTION = {
  vega: 'text-sm text-muted-foreground',
  nova: 'text-sm text-muted-foreground',
  maia: 'text-sm text-muted-foreground',
  lyra: 'text-xs leading-relaxed text-muted-foreground',
  mira: 'text-xs leading-relaxed text-muted-foreground',
  luma: 'text-sm text-muted-foreground',
  sera: 'text-sm text-muted-foreground leading-relaxed mt-0.5',
  rhea: 'text-sm text-muted-foreground',
  'new-york-v4': 'text-sm text-muted-foreground',
} as const satisfies OverlayRecipes;

// The modern Content composes a ghost icon-sm Button *appearance*. This part
// borrows Dialog Close states and never installs Button behavior.
export const DIALOG_CLOSE_ICON = {
  vega: 'absolute top-4 right-4 size-8 rounded-[min(var(--radius-md),10px)] text-sm font-medium border border-transparent bg-clip-padding outline-none transition-all',
  nova: 'absolute top-2 right-2 size-7 rounded-[min(var(--radius-md),12px)] text-sm font-medium border border-transparent bg-clip-padding outline-none transition-all',
  maia: 'absolute top-4 right-4 size-8 rounded-[var(--pui-radius-4xl)] text-sm font-medium border border-transparent bg-clip-padding outline-none transition-all',
  lyra: 'absolute top-2 right-2 size-7 rounded-none text-xs font-medium border border-transparent bg-clip-padding outline-none transition-all',
  mira: 'absolute top-2 right-2 size-6 rounded-md text-xs leading-relaxed font-medium border border-transparent bg-clip-padding outline-none transition-all',
  luma: 'absolute top-4 right-4 size-8 rounded-[var(--pui-radius-4xl)] bg-secondary text-sm font-medium border border-transparent bg-clip-padding outline-none transition-all',
  sera: 'absolute top-5 right-5 size-9 rounded-none bg-secondary text-xs font-semibold uppercase tracking-widest border border-transparent bg-clip-padding outline-none transition-all',
  rhea: 'absolute top-4 right-4 size-7 rounded-[var(--pui-radius-2xl)] bg-secondary text-sm font-medium border border-transparent bg-clip-padding outline-none transition-all',
  'new-york-v4':
    'absolute right-4 top-4 rounded-sm opacity-70 transition-opacity outline-none ring-offset-0',
} as const satisfies OverlayRecipes;
