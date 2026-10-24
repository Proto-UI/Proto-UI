/** Finite static placeholder paint, not placeholder text or an emptiness condition. */
const PLACEHOLDER_COLOR_TOKENS = new Set([
  'placeholder:text-foreground',
  'placeholder:text-muted-foreground',
  'placeholder:text-primary',
  'placeholder:text-destructive',
]);
export function isPlaceholderColorTokenV0(token: string): boolean {
  return PLACEHOLDER_COLOR_TOKENS.has(token);
}
