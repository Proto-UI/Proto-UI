/** Passive New York Button paint, pinned to shadcn-ui/ui 02cad611.
 * No behavior hook: compound commands retain their single Base interaction owner.
 * See THIRD_PARTY_NOTICES.md and internal/contracts/overlay/shadcn-alert-dialog.presentation.v0.md.
 */
export const SHADCN_BUTTON_BASE_TOKENS =
  'inline-flex shrink-0 items-center justify-center rounded-md text-sm font-medium transition-all outline-none';
export const SHADCN_BUTTON_DEFAULT_SIZE_TOKENS = 'h-9 gap-2 px-4 py-2 whitespace-nowrap';
// Explicit Proto UI extension for bounded multiline labels, not fixed-size upstream parity.
export const SHADCN_BUTTON_WRAP_DEFAULT_SIZE_TOKENS =
  'min-h-9 h-auto gap-2 px-4 py-1 whitespace-normal min-w-0 max-w-full wrap-anywhere text-center';
export const SHADCN_BUTTON_DEFAULT_VARIANT_TOKENS = 'bg-primary text-primary-foreground';
export const SHADCN_BUTTON_OUTLINE_VARIANT_TOKENS =
  'border border-border bg-background text-foreground shadow-xs';
// Keep the real existing hover until lawful borrowed-state consumer closure is fixed.
// New York's /90 migration is separate; never preserve /80 via an unused seed.
export const SHADCN_BUTTON_DEFAULT_HOVER_TOKENS = 'bg-primary/80';
export const SHADCN_BUTTON_OUTLINE_HOVER_TOKENS = 'bg-accent text-accent-foreground';
export const SHADCN_BUTTON_FOCUS_TOKENS = 'border-ring ring-3 ring-ring/50';
export const SHADCN_BUTTON_DISABLED_TOKENS = 'pointer-events-none opacity-50';
