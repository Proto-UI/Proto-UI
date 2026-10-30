import { tw } from '@proto.ui/core';
import type { OverlayRecipes } from '../dialog/style';

/** The actual modern source is Sonner, not a six-part Base Toast equivalent:
 * shadcn-ui/ui 3d98900e9b73c45f035f8109e9d41ba6a51685e7,
 * bases/base/ui/sonner.tsx and each style CSS .cn-toast. Independent
 * new-york-v4/ui/sonner.tsx uses var(--radius), not a renamed modern profile.
 * Both Toaster sources bind normal bg/text/border to popover/popover-foreground/border.
 * MIT; see THIRD_PARTY_NOTICES.md. Sonner stacking, icons, swipe and its
 * internal per-part recipes are NOT implemented or imported by these mappings.
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
