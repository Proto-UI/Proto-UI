import { tw, type StyleHandle } from '@proto.ui/core';
import type { ShadcnStyleId } from '../style-scope';

// P-SHADCN-SELECT-STYLE: pinned shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7
// apps/v4/registry/bases/base/ui/select.tsx combined with the retained
// apps/v4/registry/styles/style-{vega,nova,maia,lyra,mira,luma,sera,rhea}.css
// cn-select-* and cn-menu-translucent recipes. New York v4 keeps the previously
// adopted legacy recipe; every token below is a literal so the generated style
// token closure can collect it.

/** Modern translucent popup styles: the seven new profiles plus retained Rhea. */
export const SELECT_TRANSLUCENT_STYLES = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'rhea',
] as const satisfies readonly ShadcnStyleId[];

export type SelectTranslucentStyle = (typeof SELECT_TRANSLUCENT_STYLES)[number];

/**
 * cn-select-trigger per style. Shared select.tsx base classes (flex w-fit
 * items-center justify-between whitespace-nowrap outline-none select-none)
 * stay on the unconditional surface; style padding, radius, border, size and
 * transition differ per pinned recipe.
 */
export const SELECT_TRIGGER_SURFACE: Record<SelectTranslucentStyle, string> = {
  vega: 'gap-1.5 rounded-md border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm shadow-xs transition-[color,box-shadow]',
  nova: 'gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm transition-colors',
  maia: 'gap-1.5 rounded-[var(--pui-radius-4xl)] border border-input bg-input/30 px-3 py-2 text-sm transition-colors',
  lyra: 'gap-1.5 rounded-none border border-input bg-transparent py-2 pr-2 pl-2.5 text-xs transition-colors',
  mira: 'gap-1.5 rounded-md border border-input bg-input/20 px-2 py-1.5 text-xs leading-relaxed transition-colors',
  luma: 'gap-1.5 rounded-[var(--pui-radius-3xl)] border border-transparent bg-input/50 px-3 py-2 text-sm transition-[color,box-shadow,background-color]',
  sera: 'gap-1.5 rounded-none border border-transparent border-b-input bg-transparent px-0 py-2 text-sm transition-[color,border-color]',
  rhea: 'gap-1.5 rounded-[var(--pui-radius-2xl)] border border-transparent bg-input/50 px-3 py-2 text-sm transition-[color,box-shadow] duration-200',
};

/** data-[size=default]/data-[size=sm] trigger heights per pinned recipe. */
export const SELECT_TRIGGER_SIZE: Record<SelectTranslucentStyle, { default: string; sm: string }> =
  {
    vega: { default: 'h-9', sm: 'h-8' },
    nova: { default: 'h-8', sm: 'h-7' },
    maia: { default: 'h-9', sm: 'h-8' },
    lyra: { default: 'h-8', sm: 'h-7' },
    mira: { default: 'h-7', sm: 'h-6' },
    luma: { default: 'h-9', sm: 'h-8' },
    sera: { default: 'h-10', sm: 'h-9' },
    rhea: { default: 'h-8', sm: 'h-7' },
  };

/** Nova sm additionally caps the theme radius at the pinned 10px limit. */
export const SELECT_TRIGGER_SM_RADIUS: Partial<Record<SelectTranslucentStyle, string>> = {
  nova: 'rounded-[min(var(--pui-radius-md),10px)]',
};

/** focus-visible border/ring per pinned recipe (suppressed while invalid). */
export const SELECT_TRIGGER_FOCUS: Record<SelectTranslucentStyle, string> = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-b-ring',
  rhea: 'border-ring ring-3 ring-ring/30',
};

/** aria-invalid ring/border per pinned recipe, split by light/dark meta. */
export const SELECT_TRIGGER_INVALID: Record<
  SelectTranslucentStyle,
  { light: string; dark: string }
> = {
  vega: {
    light: 'border-destructive ring-3 ring-destructive/20',
    dark: 'border-destructive/50 ring-3 ring-destructive/40',
  },
  nova: {
    light: 'border-destructive ring-3 ring-destructive/20',
    dark: 'border-destructive/50 ring-3 ring-destructive/40',
  },
  maia: {
    light: 'border-destructive ring-3 ring-destructive/20',
    dark: 'border-destructive/50 ring-3 ring-destructive/40',
  },
  lyra: {
    light: 'border-destructive ring-1 ring-destructive/20',
    dark: 'border-destructive/50 ring-1 ring-destructive/40',
  },
  mira: {
    light: 'border-destructive ring-2 ring-destructive/20',
    dark: 'border-destructive/50 ring-2 ring-destructive/40',
  },
  luma: {
    light: 'border-destructive ring-3 ring-destructive/20',
    dark: 'border-destructive/50 ring-3 ring-destructive/40',
  },
  sera: {
    light: 'border-b-destructive',
    dark: 'border-b-destructive/50',
  },
  rhea: {
    light: 'border-destructive ring-3 ring-destructive/20',
    dark: 'border-destructive/50 ring-3 ring-destructive/40',
  },
};

/** Light/dark input-surface backgrounds per pinned recipe. */
export const SELECT_TRIGGER_SURFACE_BG: Record<
  SelectTranslucentStyle,
  { dark: string | null; darkHover: string | null }
> = {
  vega: { dark: 'bg-input/30', darkHover: 'bg-input/50' },
  nova: { dark: 'bg-input/30', darkHover: 'bg-input/50' },
  maia: { dark: null, darkHover: 'bg-input/50' },
  lyra: { dark: 'bg-input/30', darkHover: 'bg-input/50' },
  mira: { dark: 'bg-input/30', darkHover: 'bg-input/50' },
  luma: { dark: null, darkHover: null },
  sera: { dark: null, darkHover: null },
  rhea: { dark: null, darkHover: null },
};

/**
 * cn-select-content combined with cn-menu-translucent on the owned Surface:
 * translucent bg-popover/70, ring/shadow/min-width and radius differ per style.
 */
export const SELECT_SURFACE_STYLE: Record<SelectTranslucentStyle, StyleHandle> = {
  vega: tw(
    'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-md bg-popover/70 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 animate-none'
  ),
  nova: tw(
    'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-lg bg-popover/70 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 animate-none'
  ),
  maia: tw(
    'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-[var(--pui-radius-2xl)] bg-popover/70 text-popover-foreground shadow-2xl ring-1 ring-foreground/5 outline-none duration-100 animate-none'
  ),
  lyra: tw(
    'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-none bg-popover/70 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 animate-none'
  ),
  mira: tw(
    'relative isolate z-50 flex flex-col box-border min-w-32 max-h-full overflow-x-hidden overflow-y-auto rounded-lg bg-popover/70 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 animate-none'
  ),
  luma: tw(
    'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-[var(--pui-radius-3xl)] bg-popover/70 text-popover-foreground shadow-lg ring-1 outline-none duration-100 animate-none'
  ),
  sera: tw(
    'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-none bg-popover/70 text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-none duration-100 animate-none'
  ),
  rhea: tw(
    'relative isolate z-50 flex flex-col box-border min-w-36 max-h-full overflow-x-hidden overflow-y-auto rounded-[var(--pui-radius-2xl)] bg-popover/70 text-popover-foreground shadow-lg ring-1 outline-none duration-100 animate-none'
  ),
};

/** cn-select-item geometry per pinned recipe; state colors stay rule-driven. */
export const SELECT_ITEM_SURFACE: Record<SelectTranslucentStyle, string> = {
  vega: 'gap-2 rounded-sm py-1.5 pr-8 pl-2 text-sm',
  nova: 'gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm',
  maia: 'gap-2.5 rounded-xl py-2 pr-8 pl-3 text-sm',
  lyra: 'gap-2 rounded-none py-2 pr-8 pl-2 text-xs',
  mira: 'min-h-7 gap-2 rounded-md px-2 py-1 text-xs leading-relaxed',
  luma: 'gap-2.5 rounded-[var(--pui-radius-2xl)] py-2 pr-8 pl-3 text-sm font-medium',
  sera: 'gap-2.5 rounded-none py-2 pr-8 pl-3 text-sm',
  rhea: 'min-h-7 gap-2 rounded-[var(--pui-radius-xl)] py-1.5 pr-8 pl-2 text-sm',
};

/** cn-select-item-indicator span size; mira leaves sizing to the inner svg. */
export const SELECT_ITEM_INDICATOR_SIZE: Record<SelectTranslucentStyle, string | null> = {
  vega: 'size-4',
  nova: 'size-4',
  maia: 'size-4',
  lyra: 'size-4',
  mira: null,
  luma: 'size-4',
  sera: 'size-4',
  rhea: 'size-4',
};

/** cn-select-group scroll margin and padding per pinned recipe. */
export const SELECT_GROUP_STYLE: Record<SelectTranslucentStyle, string> = {
  vega: 'scroll-my-1 p-1',
  nova: 'scroll-my-1 p-1',
  maia: 'scroll-my-1 p-1',
  lyra: 'scroll-my-1',
  mira: 'scroll-my-1 p-1',
  luma: 'scroll-my-1.5 p-1.5',
  sera: 'scroll-my-1.5 p-1.5',
  rhea: 'scroll-my-1.5 p-1',
};

/** cn-select-label padding and emphasis per pinned recipe. */
export const SELECT_LABEL_STYLE: Record<SelectTranslucentStyle, string> = {
  vega: 'px-2 py-1.5 text-xs text-muted-foreground',
  nova: 'px-1.5 py-1 text-xs text-muted-foreground',
  maia: 'px-3 py-2.5 text-xs text-muted-foreground',
  lyra: 'px-2 py-2 text-xs text-muted-foreground',
  mira: 'px-2 py-1.5 text-xs text-muted-foreground',
  luma: 'px-3 py-2.5 text-xs text-muted-foreground',
  sera: 'px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground',
  rhea: 'px-2 py-1 text-xs text-muted-foreground',
};

/**
 * cn-select-separator spacing; translucent styles all use bg-foreground/5 per
 * cn-menu-translucent's separator override of cn-select-separator bg-border.
 */
export const SELECT_SEPARATOR_STYLE: Record<SelectTranslucentStyle, string> = {
  vega: 'pointer-events-none -mx-1 my-1 h-px bg-foreground/5',
  nova: 'pointer-events-none -mx-1 my-1 h-px bg-foreground/5',
  maia: 'pointer-events-none -mx-1 my-1 h-px bg-foreground/5',
  lyra: 'pointer-events-none -mx-1 h-px bg-foreground/5',
  mira: 'pointer-events-none -mx-1 my-1 h-px bg-foreground/5',
  luma: 'pointer-events-none mx-[-0.375rem] my-1.5 h-px bg-foreground/5',
  sera: 'pointer-events-none mx-[-0.375rem] my-1.5 h-px bg-foreground/5',
  rhea: 'pointer-events-none -mx-1 my-1 h-px bg-foreground/5',
};
