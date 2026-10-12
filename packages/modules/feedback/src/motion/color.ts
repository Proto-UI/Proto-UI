export type MotionRgba = readonly [number, number, number, number];
/** Canonical premultiplied Oklab vector. Input/output sRGB components are 0..1. */
export function colorToMotionVector(c: MotionRgba): readonly number[] {
  if (c.length !== 4 || c.some((v) => !Number.isFinite(v) || v < 0 || v > 1))
    throw new Error('[feedback.motion] Invalid color');
  const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = c.slice(0, 3).map(linear),
    a = c[3];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return Object.freeze([
    (0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s) * a,
    (1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s) * a,
    (0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s) * a,
    a,
  ]);
}
export function motionVectorToColor(v: readonly number[]): MotionRgba {
  const a = Math.max(0, Math.min(1, v[3]));
  if (a === 0) return Object.freeze([0, 0, 0, 0]);
  const L = v[0] / a,
    A = v[1] / a,
    B = v[2] / a;
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3,
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3,
    s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const gamma = (n: number) =>
    Math.max(0, Math.min(1, n <= 0.0031308 ? 12.92 * n : 1.055 * n ** (1 / 2.4) - 0.055));
  return Object.freeze([
    gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    a,
  ]);
}
