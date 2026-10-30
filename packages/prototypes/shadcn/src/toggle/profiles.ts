import type { ShadcnStyleId } from '../style-scope';

/** MIT shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7:
 * apps/v4/registry/bases/base/ui/toggle.tsx and all eight retained
 * apps/v4/registry/styles/style-*.css .cn-toggle/variant/size rules.
 * New York independently retains 02cad61166c4c20edbc8a3f71bd720eed4c1f49b,
 * apps/v4/registry/new-york-v4/ui/toggle.tsx. No upstream runtime is loaded.
 * select-none remains the Proto action-subject policy, not an upstream claim.
 * Invalid and descendant glyph/icon selectors remain explicit parity gaps.
 * See THIRD_PARTY_NOTICES.md for the MIT copyright and permission notice.
 */
export const TOGGLE_COMMON =
  'inline-flex items-center justify-center whitespace-nowrap select-none outline-none';
export const TOGGLE_PROFILE = {
  vega: 'gap-1 rounded-md text-sm font-medium transition-[color,box-shadow]',
  nova: 'gap-1 rounded-lg text-sm font-medium transition-all',
  maia: 'gap-1 rounded-[var(--pui-radius-4xl)] text-sm font-medium transition-colors',
  lyra: 'gap-1 rounded-none text-xs font-medium transition-all',
  mira: 'gap-1 rounded-md text-xs font-medium transition-all',
  luma: 'gap-1 rounded-[var(--pui-radius-3xl)] text-sm font-medium transition-colors',
  sera: 'gap-1.5 rounded-none text-xs font-semibold uppercase tracking-widest transition-colors',
  rhea: 'gap-1 rounded-[var(--pui-radius-2xl)] text-sm font-medium transition-colors',
  'new-york-v4': 'gap-2 rounded-md text-sm font-medium transition-[color,box-shadow]',
} as const satisfies Record<ShadcnStyleId, string>;
export const TOGGLE_OUTLINE = {
  vega: 'border border-input bg-transparent shadow-xs',
  nova: 'border border-input bg-transparent',
  maia: 'border border-input bg-transparent',
  lyra: 'border border-input bg-transparent',
  mira: 'border border-input bg-transparent',
  luma: 'border border-input bg-transparent',
  sera: 'border border-input bg-transparent',
  rhea: 'border border-input bg-transparent',
  'new-york-v4': 'border border-input bg-transparent shadow-xs',
} as const satisfies Record<ShadcnStyleId, string>;
export const TOGGLE_FOCUS = {
  vega: 'border-ring ring-3 ring-ring/50',
  nova: 'border-ring ring-3 ring-ring/50',
  maia: 'border-ring ring-3 ring-ring/50',
  lyra: 'border-ring ring-3 ring-ring/50',
  mira: 'border-ring ring-3 ring-ring/50',
  luma: 'border-ring ring-3 ring-ring/30',
  sera: 'border-ring ring-3 ring-ring/30',
  rhea: 'border-ring ring-3 ring-ring/30',
  'new-york-v4': 'border-ring ring-3 ring-ring/50',
} as const satisfies Record<ShadcnStyleId, string>;
// A flat map matches the family's existing finite source extraction pattern.
export const TOGGLE_SIZE = {
  'vega-default': 'h-9 min-w-9 px-2.5',
  'vega-sm': 'h-8 min-w-8 px-2.5',
  'vega-lg': 'h-10 min-w-10 px-2.5',
  'nova-default': 'h-8 min-w-8 px-2.5',
  'nova-sm': 'h-7 min-w-7 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem]',
  'nova-lg': 'h-9 min-w-9 px-2.5',
  'maia-default': 'h-9 min-w-9 px-3',
  'maia-sm': 'h-8 min-w-8 px-3',
  'maia-lg': 'h-10 min-w-10 px-4',
  'lyra-default': 'h-8 min-w-8 px-2.5',
  'lyra-sm': 'h-7 min-w-7 px-2.5',
  'lyra-lg': 'h-9 min-w-9 px-2.5',
  'mira-default': 'h-7 min-w-7 px-2',
  'mira-sm': 'h-6 min-w-6 rounded-[min(var(--radius-md),8px)] px-2 text-[0.625rem]',
  'mira-lg': 'h-8 min-w-8 px-2.5',
  'luma-default': 'h-9 min-w-9 px-3',
  'luma-sm': 'h-8 min-w-8 px-3',
  'luma-lg': 'h-10 min-w-10 px-4',
  'sera-default': 'h-10 min-w-10 px-6',
  'sera-sm': 'h-9 min-w-9 px-4',
  'sera-lg': 'h-11 min-w-11 px-8',
  'rhea-default': 'h-8 min-w-8 px-2.5',
  'rhea-sm': 'h-7 min-w-7 px-2.5',
  'rhea-lg': 'h-9 min-w-9 px-2.5',
  'new-york-v4-default': 'h-9 min-w-9 px-2',
  'new-york-v4-sm': 'h-8 min-w-8 px-1.5',
  'new-york-v4-lg': 'h-10 min-w-10 px-2.5',
} as const satisfies Record<`${ShadcnStyleId}-${'default' | 'sm' | 'lg'}`, string>;
