// Family-private physical data, not an input owner or a Rule/state helper.
// Static hover is a restrained project approximation, not pointer-following optics.
// Owning setups spell out eligibility and exclusions so existing lowering sees
// their actual borrowed Base handles. Keep geometry and fallback colors local.
export const COMMAND_HOVER = 'shadow-md ring-1 ring-inset ring-border';
export const COMMAND_PRESS = 'shadow-xs';
export const COMMAND_FOCUS =
  'outline-none forced-colors-focus-outline ring-2 ring-ring ring-offset-2 ring-offset-background';
export const COMMAND_FOCUS_INSET =
  'outline-none forced-colors-focus-outline ring-2 ring-ring ring-inset';
// Keep the declared same-state opaque pair; whole-host alpha depends on the backdrop.
export const COMMAND_DISABLED = 'pointer-events-none cursor-default shadow-none';
export const COMMAND_BLOCKED = 'cursor-not-allowed shadow-none';
export const COMMAND_DISABLED_FOCUSABLE = 'cursor-default shadow-none';
export const COMMAND_FOCUSED_ELEVATION = 'shadow-md';
