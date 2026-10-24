// The style compiler preserves three composable layers for shadow-none:
// ring offset, ring, and elevation (proto-style-css.ts composedShadow).
// Validate every alpha and geometric component, not a substring or token.
export function hasZeroTransparentTreeShadow(value: string): boolean {
  if (value === 'none') return true;
  const layer = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
  return value === [layer, layer, layer].join(', ');
}
