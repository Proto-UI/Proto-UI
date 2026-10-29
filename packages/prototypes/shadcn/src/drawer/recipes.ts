import type { OverlayRecipes } from '../dialog/style';

/** Modern CSS .cn-drawer-content/header/footer/handle at 3d98900e9b73,
 * composed with apps/v4/registry/bases/radix/ui/drawer.tsx (Vaul), not the
 * different Base UI Popup/Viewport/450ms stack protocol inspected at that pin.
 * New York remains 02cad61166c4c20edbc8a3f71bd720eed4c1f49b drawer.tsx.
 * MIT; package THIRD_PARTY_NOTICES.md. Base accepted side/extent/Scroll and
 * the existing 500ms Vaul presence declaration remain the semantic boundary.
 */
export const DRAWER_CONTENT = {
  vega: 'bg-popover text-popover-foreground flex h-auto flex-col text-sm',
  nova: 'bg-popover text-popover-foreground flex h-auto flex-col text-sm',
  maia: 'relative flex h-auto flex-col bg-transparent p-4 text-sm text-popover-foreground',
  lyra: 'bg-popover text-popover-foreground flex h-auto flex-col text-xs leading-relaxed rounded-none',
  mira: 'relative flex h-auto flex-col bg-transparent p-2 text-xs leading-relaxed text-popover-foreground',
  luma: 'relative flex h-auto flex-col bg-transparent p-4 text-sm',
  sera: 'bg-popover text-popover-foreground flex h-auto flex-col text-sm rounded-none',
  rhea: 'relative flex h-auto flex-col bg-transparent p-4 text-sm',
  'new-york-v4': 'bg-background text-foreground flex h-auto flex-col',
} as const satisfies OverlayRecipes;

// An owned inert decoration preserves before: inset paint without introducing
// a child overlay, scroll surface, logical owner or pseudo-selector escape.
export const DRAWER_INSET = {
  maia: 'absolute inset-2 -z-10 bg-popover border border-border rounded-[var(--pui-radius-4xl)]',
  mira: 'absolute inset-2 -z-10 bg-popover border border-border rounded-xl',
  luma: 'absolute inset-2 -z-10 bg-popover border border-border rounded-[var(--pui-radius-4xl)] shadow-xl',
  rhea: 'absolute inset-2 -z-10 bg-popover border border-border rounded-[min(var(--pui-radius-4xl),24px)] shadow-xl',
} as const;

export const DRAWER_HEADER = {
  vega: 'gap-0.5 p-4',
  nova: 'gap-0.5 p-4',
  maia: 'gap-0.5 p-4',
  lyra: 'gap-0.5 p-4',
  mira: 'gap-1 p-4',
  luma: 'gap-0.5 p-4',
  sera: 'gap-1 p-4',
  rhea: 'gap-0.5 p-4',
  'new-york-v4': 'gap-0.5 p-4',
} as const satisfies OverlayRecipes;

export const DRAWER_TITLE = {
  vega: 'text-foreground font-medium',
  nova: 'text-foreground text-base font-medium',
  maia: 'text-foreground text-base font-medium',
  lyra: 'text-foreground text-sm font-medium',
  mira: 'text-foreground text-sm font-medium',
  luma: 'text-foreground text-base font-medium',
  sera: 'text-foreground text-lg font-semibold uppercase tracking-wider',
  rhea: 'text-foreground text-base font-medium',
  'new-york-v4': 'text-foreground font-semibold',
} as const satisfies OverlayRecipes;

export const DRAWER_DESCRIPTION = {
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

export const DRAWER_BOTTOM_HANDLE = {
  vega: 'h-1.5 rounded-full',
  nova: 'h-1 rounded-full',
  maia: 'h-1.5 rounded-full',
  lyra: 'h-1 rounded-none',
  mira: 'h-1.5 rounded-full',
  luma: 'h-1.5 rounded-full',
  sera: 'h-1.5 rounded-none',
  rhea: 'h-1.5 rounded-full',
  'new-york-v4': 'h-2 rounded-full',
} as const satisfies OverlayRecipes;
