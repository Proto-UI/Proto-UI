/** Adapter-private source facts for profile 6, never author shader parameters.
 * The caller has already admitted the complete opaque source. Both preparation
 * backends use these same input bytes; no GPU readback or extra source is needed.
 * Cache this tuple with the existing exact prepared-source identity only. */
export type StyleTintSourceTone = [low: number, range: number, boost: number, reserved: 0];

export function styleTintSourceTone(pixels: Uint8Array): StyleTintSourceTone {
  if (!(pixels instanceof Uint8Array) || !pixels.length || pixels.length % 4)
    throw new Error('invalid-style-tint-source');
  let minR = pixels[0],
    minG = pixels[1],
    minB = pixels[2],
    maxR = minR,
    maxG = minG,
    maxB = minB;
  for (let at = 4; at < pixels.length; at += 4) {
    const r = pixels[at],
      g = pixels[at + 1],
      b = pixels[at + 2];
    if (r < minR) minR = r;
    else if (r > maxR) maxR = r;
    if (g < minG) minG = g;
    else if (g > maxG) maxG = g;
    if (b < minB) minB = b;
    else if (b > maxB) maxB = b;
    // No later byte can widen this full RGB cube. The caller's complete alpha
    // admission still precedes this statistics pass, including on cache hits.
    if (!(minR | minG | minB) && maxR === 255 && maxG === 255 && maxB === 255) break;
  }
  // Convex prefilter/LINEAR samples and chromatic channel displacement stay
  // within channel extrema. Reserve all static/contact lighting (0..0.21),
  // including held rim light, plus a nominal encoded byte on each side.
  // This work interval does not certify accumulated highp/mediump GPU error.
  const low = Math.max(0, (0.2126 * minR + 0.7152 * minG + 0.0722 * minB - 1) / 255);
  const high = Math.min(1, (0.2126 * maxR + 0.7152 * maxG + 0.0722 * maxB + 1) / 255 + 0.21);
  // Bind the coefficient to the exact interval sent through uniform4fv. Round
  // range/boost inward so float32 representation cannot move low+range past 1
  // or make the real-valued slope bounds exceed [0.5,1.5]. The one-code work
  // reserve exceeds this nominal representation contraction; GPU arithmetic
  // and the resulting color still require the unchanged actual-byte readback.
  const scalar = new Float32Array(1);
  const bits = new Uint32Array(scalar.buffer);
  const inward = (value: number) => {
    scalar[0] = value;
    if (scalar[0] > value) bits[0]--;
    return scalar[0];
  };
  const representedLow = Math.fround(low);
  const range = inward(Math.max(0, Math.min(high - representedLow, 1 - representedLow)));
  const boost = inward(0.5 / Math.max(range, 1 - range));
  // F(t) = outside*t + boost*clamp(t-low,0,range). Its endpoint values are
  // 0 and 1, and slopes remain 0.5..1.5. The nonzero outside term preserves
  // a brightness shift between sources; this is not min/max normalization.
  // The shader uses t + boost*(clamp(t-low,0,range)-range*t), so it does not
  // upload an independently rounded outside coefficient. The fourth slot is
  // reserved zero in the existing vec4 upload ABI, not an author parameter.
  return [representedLow, range, boost, 0];
}
