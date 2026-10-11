import { getSemanticGroupKeyV0 } from '@proto.ui/core';

export type OpaqueRgba = readonly [number, number, number, 1];
export type MaterialPalette = Readonly<
  Record<string, string | OpaqueRgba | Readonly<{ role: string }>>
>;
export type MaterialPaletteSnapshot = Readonly<{ revision: number; colors: MaterialPalette }>;
export type MaterialPaletteSource = {
  current(): MaterialPaletteSnapshot;
  subscribe(invalidate: () => void): () => void;
};
export function opaqueRgba(value: unknown): value is OpaqueRgba {
  return (
    Array.isArray(value) &&
    value.length === 4 &&
    value[3] === 1 &&
    [0, 1, 2, 3].every(
      (i) => Object.hasOwn(value, i) && Number.isFinite(value[i]) && value[i] >= 0 && value[i] <= 1
    )
  );
}
export function resolvePaletteColor(
  value: string | OpaqueRgba | Readonly<{ role: string }> | undefined,
  palette: MaterialPalette,
  seen = new Set<string>()
): OpaqueRgba | null {
  if (opaqueRgba(value)) return Object.freeze([...value]) as OpaqueRgba;
  if (value && typeof value === 'object' && 'role' in value) {
    if (seen.has(value.role)) return null;
    seen.add(value.role);
    return resolvePaletteColor(palette[value.role], palette, seen);
  }
  if (typeof value !== 'string') return null;
  if (/^#[\da-f]{3}$/i.test(value)) value = '#' + [...value.slice(1)].map((c) => c + c).join('');
  if (/^#[\da-f]{6}$/i.test(value))
    return Object.freeze([
      parseInt(value.slice(1, 3), 16) / 255,
      parseInt(value.slice(3, 5), 16) / 255,
      parseInt(value.slice(5, 7), 16) / 255,
      1,
    ]);
  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/
  );
  const result = rgb
    ? [
        Number(rgb[1]) / 255,
        Number(rgb[2]) / 255,
        Number(rgb[3]) / 255,
        rgb[4] ? Number(rgb[4]) : 1,
      ]
    : null;
  return opaqueRgba(result) ? Object.freeze(result) : null;
}
export function rgbaCss(value: OpaqueRgba) {
  return `rgb(${value
    .slice(0, 3)
    .map((v) => v * 255)
    .join(', ')})`;
}
export function colorContrast(a: OpaqueRgba, b: OpaqueRgba) {
  const luminance = (c: OpaqueRgba) =>
    c
      .slice(0, 3)
      .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
      .reduce((s, v, i) => s + v * [0.2126, 0.7152, 0.0722][i], 0);
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
/** Resolves only the governed, already post-patch token IR. Computed CSS is not
 * used to invent an owner, select a palette role, or complete a missing fill. */
export function resolveMaterialStyle(tokens: readonly string[], palette: MaterialPalette) {
  const paint: string[] = [],
    foregrounds: string[] = [];
  const competingPaint: Array<'background-image' | 'backdrop' | 'coat'> = [];
  let provenance: 'post-patch-complete' | 'selector-dependent' | 'unknown' = 'post-patch-complete';
  for (const token of tokens) {
    if (/^selection:[^:]+$/.test(token)) continue;
    if (/^bg-(clip|origin)-/.test(token)) provenance = 'unknown';
    if (token.includes(':')) {
      provenance = 'selector-dependent';
      continue;
    }
    if (/^(backdrop-)/.test(token)) competingPaint.push('backdrop');
    if (/^(bg-(gradient|linear|radial|conic)|from-|via-|to-)/.test(token))
      competingPaint.push('background-image');
    if (getSemanticGroupKeyV0(token) === 'bg-') paint.push(token);
    if (getSemanticGroupKeyV0(token) === 'text-color') foregrounds.push(token);
  }
  const resolve = (token: string | undefined, prefix: string) => {
    if (!token) return null;
    const role = token.slice(prefix.length);
    if (role.includes('/') || role === 'transparent' || role === 'current') return null;
    return resolvePaletteColor(
      role === 'white' ? '#ffffff' : role === 'black' ? '#000000' : palette[role],
      palette
    );
  };
  const fill = paint.length === 1 ? resolve(paint[0], 'bg-') : null;
  const foreground = foregrounds.length === 1 ? resolve(foregrounds[0], 'text-') : null;
  if (!fill || !foreground || colorContrast(fill, foreground) < 4.5) provenance = 'unknown';
  return Object.freeze({
    provenance,
    fill,
    foreground,
    competingPaint: Object.freeze(competingPaint),
    fillTokens: Object.freeze(paint),
    tokens: Object.freeze([...tokens]),
  });
}
