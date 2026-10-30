import type { ShadcnStyleId } from '../style-scope';
import type { ShadcnButtonSize } from './types';

/** MIT shadcn-ui/ui source-only projection, never an upstream runtime import.
 * Eight modern recipes: 3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * apps/v4/registry/styles/style-{vega,nova,maia,lyra,mira,luma,sera,rhea}.css,
 * .cn-button, .cn-button-variant-* and .cn-button-size-*; layout from
 * apps/v4/registry/bases/base/ui/button.tsx at that same immutable revision.
 * Rhea/Luma retain the already adopted 25af02b1 homepage geometry/paint.
 * Independent New York stays at 02cad611 in new-york.ts; compound paint.ts
 * retains its own contract. See THIRD_PARTY_NOTICES.md for the MIT notice.
 * Nested glyph/invalid/expanded selectors and extra upstream sizes are not
 * implemented by these finite recipes. wrap/icon-compact remain Proto APIs.
 */
export const SHADCN_MODERN_ACTION_STYLES = [
  'vega',
  'nova',
  'maia',
  'lyra',
  'mira',
  'luma',
  'sera',
  'rhea',
] as const satisfies readonly ShadcnStyleId[];
export type ShadcnModernActionStyle = (typeof SHADCN_MODERN_ACTION_STYLES)[number];

export const SHADCN_ACTION_BASE =
  'inline-flex box-border shrink-0 items-center justify-center border border-transparent bg-clip-padding py-0 transition-all outline-none';
export const SHADCN_ACTION_TEXT = {
  vega: 'text-sm leading-5 font-medium',
  nova: 'text-sm leading-5 font-medium',
  maia: 'text-sm leading-5 font-medium',
  lyra: 'text-xs font-medium',
  mira: 'text-xs leading-relaxed font-medium',
  luma: 'text-sm leading-5 font-medium',
  sera: 'text-xs font-semibold uppercase tracking-widest',
  rhea: 'text-sm leading-5 font-medium',
} as const;
export const SHADCN_ACTION_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-1 ring-ring/50',
  mira: 'border-ring ring-2 ring-ring/30',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-2 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
  'new-york': 'border-ring ring-3 ring-ring/50',
} as const;
export const SHADCN_SECONDARY_HOVER =
  'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]';
export const SHADCN_ACTION_RADIUS = {
  vega: 'rounded-md',
  nova: 'rounded-lg',
  maia: 'rounded-[var(--pui-radius-4xl)]',
  lyra: 'rounded-none',
  mira: 'rounded-md',
  luma: 'rounded-[var(--pui-radius-4xl)]',
  sera: 'rounded-none',
  rhea: 'rounded-[var(--pui-radius-2xl)]',
  'new-york-v4': 'rounded-md',
  'new-york': 'rounded-md',
} as const;
export const SHADCN_BUTTON_OUTLINE = {
  vega: 'border-border bg-background text-foreground shadow-xs',
  nova: 'border-border bg-background text-foreground',
  maia: 'border-border bg-input/30 text-foreground',
  lyra: 'border-border bg-background text-foreground',
  mira: 'border-border bg-transparent text-foreground',
  luma: 'border-border bg-background text-foreground',
  sera: 'border-border bg-transparent text-foreground',
  rhea: 'border-border bg-background text-foreground',
} as const;
export const SHADCN_BUTTON_OUTLINE_HOVER = {
  vega: 'bg-muted text-foreground',
  nova: 'bg-muted text-foreground',
  maia: 'bg-input/50 text-foreground',
  lyra: 'bg-muted text-foreground',
  mira: 'bg-input/50 text-foreground',
  luma: 'bg-muted text-foreground',
  sera: 'bg-muted text-foreground',
  rhea: 'bg-muted text-foreground',
} as const;

// Flat keys preserve the existing source-token collector's finite lookup path.
// icon-compact intentionally keeps its own size-7/gap-2/rounded-md boundary;
// it is neither the profile's upstream icon-sm nor an extra upstream API.
export const SHADCN_ACTION_SIZES: Record<`${ShadcnModernActionStyle}-${ShadcnButtonSize}`, string> =
  {
    'vega-default': 'h-9 gap-1.5 px-2.5 whitespace-nowrap',
    'vega-sm': 'h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 whitespace-nowrap',
    'vega-lg': 'h-10 gap-1.5 px-2.5 whitespace-nowrap',
    'vega-icon': 'size-9 whitespace-nowrap',
    'vega-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
    'nova-default': 'h-8 gap-1.5 px-2.5 whitespace-nowrap',
    'nova-sm':
      'h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] whitespace-nowrap',
    'nova-lg': 'h-9 gap-1.5 px-2.5 whitespace-nowrap',
    'nova-icon': 'size-8 whitespace-nowrap',
    'nova-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
    'maia-default': 'h-9 gap-1.5 px-3 whitespace-nowrap',
    'maia-sm': 'h-8 gap-1 px-3 whitespace-nowrap',
    'maia-lg': 'h-10 gap-1.5 px-4 whitespace-nowrap',
    'maia-icon': 'size-9 whitespace-nowrap',
    'maia-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
    'lyra-default': 'h-8 gap-1.5 px-2.5 whitespace-nowrap',
    'lyra-sm': 'h-7 gap-1 px-2.5 whitespace-nowrap',
    'lyra-lg': 'h-9 gap-1.5 px-2.5 whitespace-nowrap',
    'lyra-icon': 'size-8 whitespace-nowrap',
    'lyra-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
    'mira-default': 'h-7 gap-1 px-2 whitespace-nowrap',
    'mira-sm': 'h-6 gap-1 px-2 whitespace-nowrap',
    'mira-lg': 'h-8 gap-1 px-2.5 whitespace-nowrap',
    'mira-icon': 'size-7 whitespace-nowrap',
    'mira-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
    'luma-default': 'h-9 gap-1.5 px-3 whitespace-nowrap',
    'luma-sm': 'h-8 gap-1 px-3 whitespace-nowrap',
    'luma-lg': 'h-10 gap-1.5 px-4 whitespace-nowrap',
    'luma-icon': 'size-9 whitespace-nowrap',
    'luma-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
    'sera-default': 'h-10 gap-1.5 px-6 whitespace-nowrap',
    'sera-sm': 'h-9 gap-1 px-4 whitespace-nowrap',
    'sera-lg': 'h-11 gap-1.5 px-8 whitespace-nowrap',
    'sera-icon': 'size-10 whitespace-nowrap',
    'sera-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
    'rhea-default': 'h-8 gap-1.5 px-3 whitespace-nowrap',
    'rhea-sm': 'h-7 gap-1 px-3 whitespace-nowrap',
    'rhea-lg': 'h-9 gap-1.5 px-4 whitespace-nowrap',
    'rhea-icon': 'size-8 whitespace-nowrap',
    'rhea-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
  };
export const SHADCN_ACTION_WRAP_SIZES = {
  'vega-default':
    'min-h-9 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'vega-sm':
    'min-h-8 h-auto gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'vega-lg': 'min-h-10 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'nova-default':
    'min-h-8 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'nova-sm':
    'min-h-7 h-auto gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 py-1 text-[0.8rem] min-w-0 max-w-full whitespace-normal break-words',
  'nova-lg': 'min-h-9 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'maia-default':
    'min-h-9 h-auto gap-1.5 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'maia-sm': 'min-h-8 h-auto gap-1 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'maia-lg': 'min-h-10 h-auto gap-1.5 px-4 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'lyra-default':
    'min-h-8 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'lyra-sm': 'min-h-7 h-auto gap-1 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'lyra-lg': 'min-h-9 h-auto gap-1.5 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'mira-default': 'min-h-7 h-auto gap-1 px-2 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'mira-sm': 'min-h-6 h-auto gap-1 px-2 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'mira-lg': 'min-h-8 h-auto gap-1 px-2.5 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'luma-default':
    'min-h-9 h-auto gap-1.5 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'luma-sm': 'min-h-8 h-auto gap-1 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'luma-lg': 'min-h-10 h-auto gap-1.5 px-4 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'sera-default':
    'min-h-10 h-auto gap-1.5 px-6 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'sera-sm': 'min-h-9 h-auto gap-1 px-4 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'sera-lg': 'min-h-11 h-auto gap-1.5 px-8 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'rhea-default':
    'min-h-8 h-auto gap-1.5 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'rhea-sm': 'min-h-7 h-auto gap-1 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'rhea-lg': 'min-h-9 h-auto gap-1.5 px-4 py-1 min-w-0 max-w-full whitespace-normal break-words',
} as const;
