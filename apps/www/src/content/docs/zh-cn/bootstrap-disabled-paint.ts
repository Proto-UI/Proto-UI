// proto-style-css.ts composes ring-offset, ring and component shadows. Its
// shadow-none projection keeps those three slots as transparent zero geometry;
// Chromium therefore need not serialize the computed value as the word "none".
// Keep this finite: any inset, visible color or nonzero geometry must fail.
const transparentZeroLayer = 'rgba(0, 0, 0, 0) 0px 0px 0px 0px';
const composedUnpaintedShadow = Array(3).fill(transparentZeroLayer).join(', ');

export function isUnpaintedBootstrapBoxShadow(shadow: string): boolean {
  return shadow === 'none' || shadow === composedUnpaintedShadow;
}
