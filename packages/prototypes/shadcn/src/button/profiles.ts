import type { ShadcnButtonSize, ShadcnActionStyleProfile } from './types';

/** Shadcn ui 25af02b1: homepage cards use base-rhea; hero uses radix-luma.
 * These are named family recipes, not a claim that all Shadcn styles are equal.
 * Compound AlertDialog/Drawer paint retains its separately pinned contract.
 */
export const SHADCN_ACTION_BASE =
  'inline-flex box-border shrink-0 items-center justify-center border border-transparent bg-clip-padding py-0 text-sm leading-5 font-medium transition-all outline-none';
export const SHADCN_ACTION_FOCUS = 'border-ring ring-3 ring-ring/30';
export const SHADCN_SECONDARY_HOVER =
  'bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]';
export const SHADCN_ACTION_RADIUS = {
  rhea: 'rounded-[var(--pui-radius-2xl)]',
  luma: 'rounded-[var(--pui-radius-4xl)]',
} as const;
// Flat keys are intentional: the published static token extractor resolves one
// map lookup. Nested profile/size lookups would silently lose preset closure.
export const SHADCN_ACTION_SIZES: Record<
  `${ShadcnActionStyleProfile}-${ShadcnButtonSize}`,
  string
> = {
  'rhea-default': 'h-8 gap-1.5 px-3 whitespace-nowrap',
  'rhea-sm': 'h-7 gap-1 px-3 whitespace-nowrap',
  'rhea-lg': 'h-9 gap-1.5 px-4 whitespace-nowrap',
  'rhea-icon': 'size-8 whitespace-nowrap',
  'rhea-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
  'luma-default': 'h-9 gap-1.5 px-3 whitespace-nowrap',
  'luma-sm': 'h-8 gap-1 px-3 whitespace-nowrap',
  'luma-lg': 'h-10 gap-1.5 px-4 whitespace-nowrap',
  'luma-icon': 'size-9 whitespace-nowrap',
  'luma-icon-compact': 'size-7 gap-2 rounded-md whitespace-nowrap',
};
export const SHADCN_ACTION_WRAP_SIZES = {
  'rhea-default':
    'min-h-8 h-auto gap-1.5 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'rhea-sm': 'min-h-7 h-auto gap-1 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'rhea-lg': 'min-h-9 h-auto gap-1.5 px-4 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'luma-default':
    'min-h-9 h-auto gap-1.5 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'luma-sm': 'min-h-8 h-auto gap-1 px-3 py-1 min-w-0 max-w-full whitespace-normal break-words',
  'luma-lg': 'min-h-10 h-auto gap-1.5 px-4 py-1 min-w-0 max-w-full whitespace-normal break-words',
} as const;
