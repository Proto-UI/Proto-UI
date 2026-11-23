import { contactFragment } from './contact-profile';
import { fragment } from './liquidgl-kernel.generated';
import { colorContrast, opaqueRgba, type OpaqueRgba } from './style';

/** First-party, opt-in regular style-fill profile. No Apple equivalence or
 * author parameters. Refraction and contact still sample the admitted source;
 * all lighting is mapped inside the reserved semantic-foreground contrast bound.
 * Profile 5 added the frozen source-budgeted shoulder only in the inherited
 * highp branch; mediump retains the old offset. Its finite budget assumes
 * regular/opaque/frost=0/tilt=0/stack-disabled, radius-3 source prefiltering.
 * Profile 6 adds bounded source-owned tone gain before the same foreground map.
 * Neutral shaders, foreground safety and the shoulder stay unchanged. */
export const styleTintProfile = 'pui-regular-style-tint-6';
export const styleTintContactProfile = 'pui-regular-style-tint-contact-6';

const weights = [0.2126, 0.7152, 0.0722] as const;
const decode = (channel: number) =>
  channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
function luminance(value: OpaqueRgba) {
  return weights.reduce((sum, weight, i) => sum + weight * decode(value[i]), 0);
}

export function styleTintLightForeground(fill: OpaqueRgba, foreground: OpaqueRgba): boolean {
  if (!opaqueRgba(fill) || !opaqueRgba(foreground) || colorContrast(fill, foreground) < 4.5)
    throw new Error('invalid-style-tint-palette');
  return luminance(foreground) > luminance(fill);
}

/** Adapter-private proof inputs, always derived from one semantic frame. */
export function styleTintEnvelope(fill: OpaqueRgba, foreground: OpaqueRgba) {
  const lightForeground = styleTintLightForeground(fill, foreground);
  const shift = (lightForeground ? -1 : 1) * (1.5 / 255);
  const worstForeground: OpaqueRgba = [
    Math.max(0, Math.min(1, foreground[0] + shift)),
    Math.max(0, Math.min(1, foreground[1] + shift)),
    Math.max(0, Math.min(1, foreground[2] + shift)),
    1,
  ];
  const foregroundLuma = luminance(worstForeground);
  const raw = lightForeground
    ? (foregroundLuma + 0.05) / 4.5 - 0.05
    : 4.5 * (foregroundLuma + 0.05) - 0.05;
  let bound: number;
  if (lightForeground) {
    if (raw < 0 || lightReserve(0) > raw) throw new Error('style-tint-empty-budget');
    let low = 0,
      high = raw;
    // H(X) = X + reserve(X) is strictly increasing. Keep the feasible endpoint;
    // a fixed iteration count is not an accumulated GPU arithmetic error bound.
    for (let step = 0; step < 32; step++) {
      const middle = (low + high) / 2;
      if (middle + lightReserve(middle) <= raw) low = middle;
      else high = middle;
    }
    bound = low;
  } else {
    // Full near-opaque shape/black-shadow reserve, not just opaque RGB rounding.
    bound = raw + 0.0675118372261112;
  }
  if (!(bound > 0 && bound < 1)) throw new Error('style-tint-empty-budget');
  // WebGL uniform1f converts to float32. Round toward the safe side explicitly;
  // this does not certify arithmetic on either highp or mediump implementations.
  const representation = new Float32Array([bound]);
  if (lightForeground ? representation[0] > bound : representation[0] < bound) {
    const bits = new Uint32Array(representation.buffer);
    bits[0] += lightForeground ? -1 : 1;
  }
  const luminanceBound = representation[0];
  if (!(luminanceBound > 0 && luminanceBound < 1)) throw new Error('style-tint-empty-budget');
  return { lightForeground, luminanceBound, worstForeground };
}

const joinCode = 0.04045;
const joinLow = joinCode / 12.92;
const joinHigh = ((joinCode + 0.055) / 1.055) ** 2.4;
const joinJump = joinHigh - joinLow;
const lightCodeError = 5.5 / 255;
function upperInverse(value: number) {
  if (value <= joinLow) return 12.92 * value;
  if (value < joinHigh) return joinCode;
  return 1.055 * value ** (1 / 2.4) - 0.055;
}
function lightReserve(bound: number) {
  const continuousDecode = (value: number) => decode(value) - (value > joinCode ? joinJump : 0);
  return weights.reduce((sum, weight) => {
    // Saturation maximizes the fixed-code increment at 1 - delta, never at 1.
    const code = Math.min(upperInverse(Math.min(bound / weight, 1)), 1 - lightCodeError);
    return (
      sum + weight * (continuousDecode(code + lightCodeError) - continuousDecode(code) + joinJump)
    );
  }, 0);
}

const helpers = `
        uniform float u_styleTintLightForeground;
        uniform float u_styleTintLuminanceBound;
        uniform vec4 u_styleTintSourceTone;
        vec3 styleTintLinear(vec3 value) {
          return mix(value / 12.92, pow((value + 0.055) / 1.055, vec3(2.4)),
                     step(vec3(0.04045), value));
        }
        vec3 styleTintSrgb(vec3 value) {
          return mix(value * 12.92, 1.055 * pow(value, vec3(1.0 / 2.4)) - 0.055,
                     step(vec3(0.0031308), value));
        }
`;
const mapping = `
          // Retain the admitted optical source's spatial tone and chroma.
          // The safe bound is luminance, not a narrow per-channel solid-fill band.
          vec3 styleTintDetail = clamp(final.rgb, 0.0, 1.0);
          vec3 styleTintBase = styleTintLinear(u_tint.rgb);
          vec3 styleTintWeights = vec3(0.2126, 0.7152, 0.0722);
          float styleTintTone = dot(styleTintDetail, styleTintWeights);
          // The source-derived interval increases local detail with slopes
          // bounded to 0.5..1.5. Its outside term remains strictly positive:
          // this never clamps a continuous input interval to constant tone.
          styleTintTone = clamp(styleTintTone + u_styleTintSourceTone.z *
            (clamp(styleTintTone - u_styleTintSourceTone.x, 0.0, u_styleTintSourceTone.y) -
             u_styleTintSourceTone.y * styleTintTone), 0.0, 1.0);
          vec3 styleTintHue = mix(styleTintBase, styleTintLinear(styleTintDetail), 0.25);
          float styleTintBoundCode = styleTintSrgb(vec3(u_styleTintLuminanceBound)).r;
          float styleTintTargetCode = mix(
            styleTintBoundCode + (1.0 - styleTintBoundCode) * styleTintTone,
            styleTintBoundCode * styleTintTone, u_styleTintLightForeground);
          float styleTintTarget = styleTintLinear(vec3(styleTintTargetCode)).r;
          // 2^-12 remains normal at the inherited minimum mediump precision.
          // Both branches must stay finite, including black/white endpoints.
          vec3 styleTintDark = styleTintHue *
            (styleTintTarget /
             max(dot(styleTintHue, styleTintWeights), 0.000244140625));
          vec3 styleTintComplement = vec3(1.0) - styleTintHue;
          vec3 styleTintLight = vec3(1.0) - styleTintComplement *
            ((1.0 - styleTintTarget) /
             max(dot(styleTintComplement, styleTintWeights), 0.000244140625));
          // Gamut clipping only moves farther onto the foreground-safe side:
          // down in luminance for light text, up for dark text. Readback guards
          // still reject any finite-precision or near-opaque contrast failure.
          final.rgb = styleTintSrgb(clamp(mix(styleTintLight, styleTintDark,
                                             u_styleTintLightForeground), 0.0, 1.0));

`;
// Frozen first-party v2b: four side factors for each R/G/B/base footprint.
// No new source taps or precision promotion; the base qualification is required
// even though its unchanged sample normally does not contribute to final color.
const budgetHelpers = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        vec2 budgetSide(vec2 margin, vec2 delta, vec2 tau) {
          vec2 m = max(margin, vec2(0.0));
          vec2 square = m * m;
          return square / (square + delta * delta + tau * tau);
        }
        float budgetChannel(vec2 center, vec2 delta, vec2 margin, vec2 tau, float product) {
          vec2 low = budgetSide(center - margin, delta, tau);
          vec2 high = budgetSide(vec2(1.0) - margin - center, delta, tau);
          product = product * low.x;
          product = product * low.y;
          product = product * high.x;
          product = product * high.y;
          return product;
        }
        #endif
`;
const budgetOffset = `          vec2 finalOffset = oldOffset;
          #ifdef GL_FRAGMENT_PRECISION_HIGH
          float budgetShortSide = min(u_boxSize.x, u_boxSize.y);
          // dmask already reflects the applicable static/contact shape radius.
          float budgetDepth = -dmask;
          float budgetGate = smoothstep((2.0 / 38.0) * budgetShortSide,
                                       (4.0 / 38.0) * budgetShortSide, budgetDepth);
          float budgetWide = 1.0 - smoothstep(0.0, 0.44 * budgetShortSide, budgetDepth);
          vec2 budgetDelta = refractDir *
            (u_refraction * centreBlend * budgetGate * (budgetWide - edge));
          vec2 budgetTexel = 1.0 / u_textureResolution;
          float budgetR = 1.0 - u_aberration;
          float budgetB = 1.0 + u_aberration;
          float budgetLambda = budgetChannel(
            mapped + budgetR * oldOffset, budgetR * budgetDelta,
            3.5 / u_textureResolution, budgetTexel, 1.0);
          budgetLambda = budgetChannel(
            mapped + oldOffset, budgetDelta,
            4.5 / u_textureResolution, budgetTexel, budgetLambda);
          budgetLambda = budgetChannel(
            mapped + budgetB * oldOffset, budgetB * budgetDelta,
            3.5 / u_textureResolution, budgetTexel, budgetLambda);
          // BaseCol is unchanged, but its old full footprint must also be safe.
          budgetLambda = budgetChannel(
            mapped, vec2(0.0), 3.5 / u_textureResolution, budgetTexel, budgetLambda);
          finalOffset = oldOffset + budgetLambda * budgetDelta;
          #endif
          // This FINAL declaration becomes the unique diagnostic replacement anchor.
          // strictWarpOff replaces this complete line with vec2 offset = vec2(0.0);
          // No assignment/addition to offset is permitted after this line.
          vec2 offset = finalOffset;
`;
function derive(source: string): string {
  const tint = '          final.rgb = mix(final.rgb, final.rgb * u_tint.rgb, u_tint.a);';
  const reveal = '          if (u_revealType == 1) {';
  const main = '        void main(){';
  const offset = '          vec2 offset = refractDir * offsetAmt * centreBlend;';
  const mapped = '          vec2 mapped = u_bounds.xy + flippedUV * u_bounds.zw;';
  const refracted = '          vec2 refracted = mapped + offset - tiltOffset;';
  const chroma = '          vec2 chroma = offset * u_aberration;';
  // Refuse drift instead of attaching a budget to the wrong stage, letting a
  // later write bypass it, or silently moving the strict-off diagnostic anchor.
  if (
    [tint, reveal, main, offset, mapped, refracted, chroma].some(
      (anchor) => !source.includes(anchor) || source.split(anchor.trim()).length !== 2
    ) ||
    !source.includes(mapped + '\n' + refracted) ||
    source.indexOf(offset) >= source.indexOf(mapped) ||
    source.slice(source.indexOf(main), source.indexOf(refracted)).includes('sampleSource(') ||
    // Only the declaration and the two frozen reads are allowed. This also
    // rejects component/index writes and passing offset to an out parameter.
    source.match(/\boffset\b/g)?.length !== 3
  )
    throw new Error('style-tint-profile-upstream-drift');
  return (
    source
      .replace(offset, '          vec2 oldOffset = refractDir * offsetAmt * centreBlend;')
      .replace(refracted, budgetOffset + refracted)
      .replace(tint, '          // The opt-in style tint is applied after all lighting below.')
      // Correct the derivative's two static light ramps without changing the
      // historical neutral literal. Reversed smoothstep edges are undefined GLSL.
      .replace(
        'smoothstep(0.4,0.0,distance((p_px + b_px) / u_boxSize, lp1))',
        '(1.0 - smoothstep(0.0,0.4,distance((p_px + b_px) / u_boxSize, lp1)))'
      )
      .replace(
        'smoothstep(0.5,0.0,distance((p_px + b_px) / u_boxSize, lp2))',
        '(1.0 - smoothstep(0.0,0.5,distance((p_px + b_px) / u_boxSize, lp2)))'
      )
      .replace(main, helpers + budgetHelpers + main)
      .replace(reveal, mapping + reveal)
  );
}
export const styleTintFragment = derive(fragment);
export const styleTintContactFragment = derive(contactFragment);
