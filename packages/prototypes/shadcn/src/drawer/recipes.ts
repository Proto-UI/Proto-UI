import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** Modern CSS .cn-drawer-content/header/footer/handle at 3d98900e9b73,
 * composed with apps/v4/registry/bases/radix/ui/drawer.tsx (Vaul), not the
 * different Base UI Popup/Viewport/450ms stack protocol inspected at that pin.
 * New York remains 02cad61166c4c20edbc8a3f71bd720eed4c1f49b drawer.tsx.
 * MIT; package THIRD_PARTY_NOTICES.md. Base accepted side/extent/Scroll and
 * the existing 500ms Vaul presence declaration remain the semantic boundary.
 */
export const DRAWER_CONTENT = {
  // Base already owns fixed positioning and admitted height. The upstream
  // fixed primitive overrides its stylesheet's relative/h-auto in composition.
  vega: tw('bg-popover text-popover-foreground flex flex-col text-sm'),
  nova: tw('bg-popover text-popover-foreground flex flex-col text-sm'),
  maia: tw('flex flex-col bg-transparent p-4 text-sm text-popover-foreground'),
  lyra: tw('bg-popover text-popover-foreground flex flex-col text-xs leading-relaxed rounded-none'),
  mira: tw('flex flex-col bg-transparent p-2 text-xs leading-relaxed text-popover-foreground'),
  luma: tw('flex flex-col bg-transparent p-4 text-sm'),
  sera: tw('bg-popover text-popover-foreground flex flex-col text-sm rounded-none'),
  rhea: tw('flex flex-col bg-transparent p-4 text-sm'),
  'new-york-v4': tw('bg-background text-foreground flex flex-col'),
} as const satisfies OverlayRecipes;

// An owned inert decoration preserves before: inset paint without introducing
// a child overlay, scroll surface, logical owner or pseudo-selector escape.
export const DRAWER_INSET = {
  maia: tw(
    'absolute inset-2 -z-10 bg-popover border border-border rounded-[var(--pui-radius-4xl)]'
  ),
  mira: tw('absolute inset-2 -z-10 bg-popover border border-border rounded-xl'),
  luma: tw(
    'absolute inset-2 -z-10 bg-popover border border-border rounded-[var(--pui-radius-4xl)] shadow-xl'
  ),
  rhea: tw(
    'absolute inset-2 -z-10 bg-popover border border-border rounded-[min(var(--pui-radius-4xl),24px)] shadow-xl'
  ),
} as const;

export const DRAWER_HEADER = {
  vega: tw('gap-0.5 p-4'),
  nova: tw('gap-0.5 p-4'),
  maia: tw('gap-0.5 p-4'),
  lyra: tw('gap-0.5 p-4'),
  mira: tw('gap-1 p-4'),
  luma: tw('gap-0.5 p-4'),
  sera: tw('gap-1 p-4'),
  rhea: tw('gap-0.5 p-4'),
  'new-york-v4': tw('gap-0.5 p-4'),
} as const satisfies OverlayRecipes;

export const DRAWER_TITLE = {
  vega: tw('text-foreground font-medium'),
  nova: tw('text-foreground text-base font-medium'),
  maia: tw('text-foreground text-base font-medium'),
  lyra: tw('text-foreground text-sm font-medium'),
  mira: tw('text-foreground text-sm font-medium'),
  luma: tw('text-foreground text-base font-medium'),
  sera: tw('text-foreground text-lg font-semibold uppercase tracking-wider'),
  rhea: tw('text-foreground text-base font-medium'),
  'new-york-v4': tw('text-foreground font-semibold'),
} as const satisfies OverlayRecipes;

export const DRAWER_DESCRIPTION = {
  vega: tw('text-sm text-muted-foreground'),
  nova: tw('text-sm text-muted-foreground'),
  maia: tw('text-sm text-muted-foreground'),
  lyra: tw('text-xs leading-relaxed text-muted-foreground'),
  mira: tw('text-xs leading-relaxed text-muted-foreground'),
  luma: tw('text-sm text-muted-foreground'),
  sera: tw('text-sm text-muted-foreground leading-relaxed mt-0.5'),
  rhea: tw('text-sm text-muted-foreground'),
  'new-york-v4': tw('text-sm text-muted-foreground'),
} as const satisfies OverlayRecipes;

export const DRAWER_BOTTOM_HANDLE = {
  vega: tw('h-1.5 rounded-full'),
  nova: tw('h-1 rounded-full'),
  maia: tw('h-1.5 rounded-full'),
  lyra: tw('h-1 rounded-none'),
  mira: tw('h-1.5 rounded-full'),
  luma: tw('h-1.5 rounded-full'),
  sera: tw('h-1.5 rounded-none'),
  rhea: tw('h-1.5 rounded-full'),
  'new-york-v4': tw('h-2 rounded-full'),
} as const satisfies OverlayRecipes;
