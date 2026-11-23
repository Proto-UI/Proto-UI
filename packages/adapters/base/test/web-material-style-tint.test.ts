import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  styleTintFragment,
  styleTintContactFragment,
  styleTintLightForeground,
  styleTintEnvelope,
  styleTintProfile,
  styleTintContactProfile,
} from '../src/material/style-tint-profile';
import { fragment } from '../src/material/liquidgl-kernel.generated';
import { contactFragment } from '../src/material/contact-profile';
import { colorContrast, type OpaqueRgba } from '../src/material/style';
import { styleTintSourceTone, type StyleTintSourceTone } from '../src/material/style-tint-source';
import {
  createLiquidToggleDetailStimulus,
  evaluateLiquidToggleDetailPair,
  type DetailImage,
} from '../../../../apps/www/src/content/docs/zh-cn/liquid-toggle-detail-metrics';

// Independent numeric oracle for the finite shader contract; these tests prove
// numerical bounds, not GPU execution or exact native shader output.
const linear = (x: number) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);
const srgb = (x: number) => (x <= 0.0031308 ? x * 12.92 : 1.055 * x ** (1 / 2.4) - 0.055);
function oracle(
  fill: OpaqueRgba,
  foreground: OpaqueRgba,
  sample: number[],
  old = false,
  sourceTone?: StyleTintSourceTone
): OpaqueRgba {
  const envelope = styleTintEnvelope(fill, foreground);
  const light = envelope.lightForeground;
  const weights = [0.2126, 0.7152, 0.0722];
  const dot = (rgb: number[]) => rgb.reduce((sum, c, i) => sum + c * weights[i], 0);
  const detail = sample.map((x) => Math.max(0, Math.min(1, x)));
  const base = fill.slice(0, 3).map(linear);
  const hue = base.map((c, i) => 0.75 * c + 0.25 * linear(detail[i]));
  const direction = light ? hue : hue.map((c) => 1 - c);
  const boundCode = srgb(envelope.luminanceBound);
  let tone = dot(detail);
  if (sourceTone) {
    // Independent piecewise interpolation through the three linear segments,
    // rather than the shader's endpoint-canceling expression.
    const [low, range, boost] = sourceTone;
    const outside = 1 - boost * range;
    tone =
      tone < low
        ? outside * tone
        : tone <= low + range
          ? outside * low + (outside + boost) * (tone - low)
          : 1 - outside * (1 - tone);
  }
  const targetCode = light ? boundCode * tone : boundCode + (1 - boundCode) * tone;
  // Retain the exact profile-2 map as a same-input historical control.
  const target = old
    ? light
      ? dot(base) * dot(detail)
      : (1 - dot(base)) * (1 - dot(detail))
    : light
      ? linear(targetCode)
      : 1 - linear(targetCode);
  const ratio = target / Math.max(dot(direction), 0.000244140625);
  const output = direction.map((c) =>
    srgb(Math.max(0, Math.min(1, light ? c * ratio : 1 - c * ratio)))
  );
  return [output[0], output[1], output[2], 1];
}
const pairs: readonly (readonly [OpaqueRgba, OpaqueRgba])[] = [
  [
    [0, 97 / 255, 204 / 255, 1],
    [1, 1, 1, 1],
  ],
  [
    [10 / 255, 108 / 255, 219 / 255, 1],
    [1, 1, 1, 1],
  ],
  [
    [0.85, 0.7, 0.95, 1],
    [0.05, 0.05, 0.05, 1],
  ],
  [
    [0.08, 0.12, 0.18, 1],
    [0.75, 0.8, 0.85, 1],
  ],
];
describe('bounded style-fill profile: independent numeric oracle, no GPU claim', () => {
  it.each(pairs)(
    'retains the reserved foreground bound while allowing source chroma and saturated highlights',
    (fill, foreground) => {
      const {
        lightForeground: light,
        luminanceBound,
        worstForeground,
      } = styleTintEnvelope(fill, foreground);
      let count = 0;
      for (let n = 0; n <= 255; n++)
        for (const sample of [
          [n / 255, n / 255, n / 255],
          [n / 255, 1 - n / 255, 0.4],
          [2, 2, 2],
          [-1, -1, -1],
        ]) {
          const output = oracle(fill, foreground, sample);
          count++;
          expect(output.every(Number.isFinite)).toBe(true);
          expect(output.every((x) => x >= 0 && x <= 1 + 1e-12)).toBe(true);
          expect(colorContrast(output, worstForeground)).toBeGreaterThanOrEqual(4.5);
          // Unlike the retired narrow-band profile, channels may cross the
          // fill independently; the foreground safety bound is luminance.
          const lum = (color: OpaqueRgba) =>
            color
              .slice(0, 3)
              .reduce((sum, c, i) => sum + linear(c) * [0.2126, 0.7152, 0.0722][i], 0);
          if (light) expect(lum(output)).toBeLessThanOrEqual(luminanceBound + 1e-12);
          else expect(lum(output)).toBeGreaterThanOrEqual(luminanceBound - 1e-12);
        }
      expect(count).toBeGreaterThan(0);
      expect(oracle(fill, foreground, [0, 0, 0])).not.toEqual(oracle(fill, foreground, [1, 1, 1]));
    }
  );
  it('retains source chroma that an equal-luminance scalar would erase at 8-bit output', () => {
    const fill = pairs[1][0];
    const neutral = [0.2, 0.2, 0.2];
    const chromatic = [
      0.2,
      srgb((linear(0.2) * (0.7152 + 0.0722) - linear(0.35) * 0.0722) / 0.7152),
      0.35,
    ];
    const lum = (rgb: number[]) =>
      rgb.reduce((sum, c, i) => sum + linear(c) * [0.2126, 0.7152, 0.0722][i], 0);
    expect(lum(chromatic)).toBeCloseTo(lum(neutral), 12);
    const quantized = (rgb: number[]) =>
      oracle(fill, pairs[1][1], rgb)
        .slice(0, 3)
        .map((c) => Math.round(c * 255));
    expect(quantized(chromatic)).not.toEqual(quantized(neutral));
    // The retired scalar loses this actual source distinction entirely.
    const legacy = (rgb: number[]) =>
      fill.slice(0, 3).map((c) => Math.round(srgb(linear(c) * (0.68 + 0.32 * lum(rgb))) * 255));
    expect(legacy(chromatic)).toEqual(legacy(neutral));
  });
  it('retains chroma independently of the new perceptual code-luma tone', () => {
    const gray = [0.2, 0.2, 0.2];
    const chroma = [0.2, (0.2 * (0.7152 + 0.0722) - 0.8 * 0.0722) / 0.7152, 0.8];
    const codeLuma = (rgb: number[]) =>
      rgb.reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
    expect(codeLuma(chroma)).toBeCloseTo(codeLuma(gray), 12);
    for (const [fill, foreground] of pairs.slice(0, 2)) {
      const a = oracle(fill, foreground, gray),
        b = oracle(fill, foreground, chroma);
      const quantized = (rgb: OpaqueRgba) => rgb.slice(0, 3).map((c) => Math.round(c * 255));
      expect(quantized(a)).not.toEqual(quantized(b));
      expect(colorContrast(a, foreground)).toBeCloseTo(colorContrast(b, foreground), 10);
    }
  });
  it('keeps pure red backdrop changes visible even when the accent red channel is zero', () => {
    const fill = pairs[0][0];
    const a = oracle(fill, pairs[0][1], [0.1, 0.2, 0.3]);
    const b = oracle(fill, pairs[0][1], [0.8, 0.2, 0.3]);
    expect(a[0]).toBeGreaterThan(0);
    expect(b[0]).toBeGreaterThan(a[0]);
    expect(colorContrast(a, pairs[0][1])).toBeGreaterThanOrEqual(4.5);
    expect(colorContrast(b, pairs[0][1])).toBeGreaterThanOrEqual(4.5);
  });
  it('explicitly changes collapsed black/white envelopes while keeping zero denominators finite', () => {
    const black: OpaqueRgba = [0, 0, 0, 1];
    const white: OpaqueRgba = [1, 1, 1, 1];
    for (const [fill, foreground] of [
      [black, white],
      [white, black],
    ]) {
      const outputs = [
        [0, 0, 0],
        [0.4, 0.6, 0.8],
        [1, 1, 1],
      ].map((sample) => oracle(fill, foreground, sample));
      expect(outputs.flat().every(Number.isFinite)).toBe(true);
      expect(outputs[0]).not.toEqual(outputs[2]);
      const old = oracle(fill, foreground, [0.4, 0.6, 0.8], true);
      old.forEach((channel, i) => expect(channel).toBeCloseTo(fill[i], 12));
    }
  });
  it.each(['checker', 'bands'] as const)(
    'maps authored %s stimuli above the independently frozen inner-detail engineering floor',
    (kind) => {
      const first = createLiquidToggleDetailStimulus(kind);
      const reordered = createLiquidToggleDetailStimulus(kind, true);
      for (const [fill, foreground] of pairs.slice(0, 2)) {
        const map = (image: DetailImage): DetailImage => {
          const data = new Uint8ClampedArray(image.data.length);
          for (let at = 0; at < data.length; at += 4) {
            const color = oracle(
              fill,
              foreground,
              [image.data[at], image.data[at + 1], image.data[at + 2]].map((c) => c / 255)
            );
            data.set(
              color.map((c) => Math.round(c * 255)),
              at
            );
          }
          return { width: image.width, height: image.height, data };
        };
        const report = evaluateLiquidToggleDetailPair({
          first: { reference: first, output: map(first) },
          reordered: { reference: reordered, output: map(reordered) },
          roi: { left: 16, top: 16, right: 112, bottom: 48 },
          foregroundSrgb8: [foreground[0] * 255, foreground[1] * 255, foreground[2] * 255],
        });
        expect(report.failures).toEqual([]);
        expect(report.passed).toBe(true);
        // This is only the numeric map stage, not blur/refraction/committed GPU paint.
        expect(report.evidenceScope).toBe('pure-inner-content-engineering-diagnostic');
      }
    }
  );
  it('refuses unreadable or nonopaque palette pairs before selecting a profile', () => {
    for (const [fill, fg] of [
      [
        [1, 1, 1, 1],
        [0.9, 0.9, 0.9, 1],
      ],
      [
        [0, 0, 0, 0.5],
        [1, 1, 1, 1],
      ],
      [
        [NaN, 0, 0, 1],
        [1, 1, 1, 1],
      ],
    ] as const)
      expect(() => styleTintLightForeground(fill as unknown as OpaqueRgba, fg)).toThrow(
        'invalid-style-tint-palette'
      );
  });
  it('maps all lighting before contrast bounding and preserves the source refraction code', () => {
    for (const profile of [styleTintFragment, styleTintContactFragment]) {
      expect(profile.indexOf('vec3 styleTintDetail')).toBeGreaterThan(
        profile.indexOf('if (u_specular)')
      );
      expect(profile.indexOf('vec3 styleTintDetail')).toBeLessThan(
        profile.lastIndexOf('if (u_revealType == 1)')
      );
      expect(profile).toContain('refracted = mapped + offset - tiltOffset');
      expect(profile).not.toContain('0.68 + 0.32 * styleTintDetail');
      expect(profile).toContain('uniform float u_styleTintLuminanceBound;');
      expect(profile).toContain('styleTintBoundCode * styleTintTone');
      expect(profile).toContain('styleTintLinear(vec3(styleTintTargetCode)).r');
      expect(profile).not.toContain('styleTintBaseLuma');
      expect(profile).toContain('0.000244140625');
      expect(profile).toContain('styleTintLinear(styleTintDetail), 0.25');
      expect(profile).toContain('vec3 styleTintDetail = clamp(final.rgb, 0.0, 1.0)');
      expect(profile).not.toContain('clamp(dot(styleTintLinear');
      expect(profile).not.toContain(
        'final.rgb = mix(final.rgb, final.rgb * u_tint.rgb, u_tint.a);'
      );
      expect(profile).not.toContain('smoothstep(0.4,0.0');
    }
    for (const neutral of [fragment, contactFragment])
      expect(neutral).not.toContain('styleTintDetail');
  });
});

const frozenPairs = [
  ...pairs,
  [
    [0, 0, 0, 1],
    [1, 1, 1, 1],
  ],
  [
    [1, 1, 1, 1],
    [0, 0, 0, 1],
  ],
] as readonly (readonly [OpaqueRgba, OpaqueRgba])[];
const frozenGrids = [
  [16, 48, 80],
  [96, 128, 160],
  [176, 208, 240],
  [192, 208, 224],
  [224, 239, 254],
];
const frozenLevels = [0, 32, 64, 96, 128, 160, 192, 224, 255];
function raster(colors: readonly number[][], columns = 9): DetailImage {
  return {
    width: columns * 4,
    height: (colors.length / columns) * 4,
    data: Uint8Array.from(
      Array.from({ length: colors.length * 16 }, (_, pixel) => {
        const x = pixel % (columns * 4),
          y = Math.floor(pixel / (columns * 4));
        return [
          ...colors[Math.floor(y / 4) * columns + Math.floor(x / 4)].map((c) =>
            Math.round(c * 255)
          ),
          255,
        ];
      }).flat()
    ),
  };
}
function evaluate(
  sources: number[][][],
  outputs: number[][][],
  foreground: OpaqueRgba,
  columns = 9
) {
  const reference = sources.map((s) => raster(s, columns)),
    output = outputs.map((s) => raster(s, columns));
  return evaluateLiquidToggleDetailPair({
    first: { reference: reference[0], output: output[0] },
    reordered: { reference: reference[1], output: output[1] },
    roi: { left: 0, top: 0, right: reference[0].width, bottom: reference[0].height },
    foregroundSrgb8: [foreground[0] * 255, foreground[1] * 255, foreground[2] * 255],
  });
}
function outputs(
  sources: number[][][],
  fill: OpaqueRgba,
  foreground: OpaqueRgba,
  old = false,
  sourceTone?: StyleTintSourceTone
) {
  return sources.map((image) =>
    image.map((sample) => oracle(fill, foreground, sample, old, sourceTone).slice(0, 3))
  );
}

describe('profile 6 retains historical profile 4/5 foreground arithmetic (arithmetic, not GPU acceptance)', () => {
  it('uses a distinct identity and rounds every independently frozen endpoint inward to float32', () => {
    expect(styleTintProfile).toBe('pui-regular-style-tint-6');
    expect(styleTintContactProfile).toBe('pui-regular-style-tint-contact-6');
    // Fixed independent 32-step solver results, before uniform conversion.
    const expected = [
      0.15342621431014267, 0.15342621431014267, 0.2626990541705438, 0.07198668649802203,
      0.15342621431014267, 0.24456064436506586,
    ];
    frozenPairs.forEach(([fill, foreground], index) => {
      const envelope = styleTintEnvelope(fill, foreground),
        bound = envelope.luminanceBound;
      expect(Math.fround(bound)).toBe(bound);
      expect(Math.abs(bound - expected[index])).toBeLessThan(3e-8);
      if (envelope.lightForeground) expect(bound).toBeLessThanOrEqual(expected[index]);
      else expect(bound).toBeGreaterThanOrEqual(expected[index]);
      expect(envelope.worstForeground).toEqual([
        ...foreground
          .slice(0, 3)
          .map((c) =>
            Math.max(0, Math.min(1, c + ((envelope.lightForeground ? -1 : 1) * 1.5) / 255))
          ),
        1,
      ]);
    });
  });
  it('refuses empty budgets even when the original nominal pair passes admission', () => {
    const gray: OpaqueRgba = [0.46, 0.46, 0.46, 1];
    for (const fill of [
      [0, 0, 0, 1],
      [1, 1, 1, 1],
    ] as const) {
      expect(colorContrast(fill, gray)).toBeGreaterThanOrEqual(4.5);
      expect(() => styleTintEnvelope(fill, gray)).toThrow('style-tint-empty-budget');
    }
  });
  it.each(['original30', 'holdout504'] as const)(
    'retains every old pass on frozen %s inputs',
    (kind) => {
      const grids =
        kind === 'original30'
          ? frozenGrids
          : frozenLevels.flatMap((a, i) =>
              frozenLevels
                .slice(i + 1)
                .flatMap((b, j) => frozenLevels.slice(i + j + 2).map((c) => [a, b, c]))
            );
      let oldPass = 0,
        nextPass = 0,
        oldPassLoss = 0,
        collapsedGains = 0;
      frozenPairs.forEach(([fill, foreground], palette) => {
        for (const grid of grids) {
          const first = grid.flatMap((r) =>
            grid.flatMap((g) => grid.map((b) => [r / 255, g / 255, b / 255]))
          );
          const sources = [first, first.map((_, i) => first[(10 * i + 7) % 27])];
          const old = evaluate(sources, outputs(sources, fill, foreground, true), foreground);
          const next = evaluate(sources, outputs(sources, fill, foreground), foreground);
          oldPass += Number(old.passed);
          nextPass += Number(next.passed);
          oldPassLoss += Number(old.passed && !next.passed);
          collapsedGains += Number(palette >= 4 && !old.passed && next.passed);
          // The current host result is quantized before the unchanged evaluator.
          for (const image of outputs(sources, fill, foreground))
            for (const rgb of image) {
              const quantized: OpaqueRgba = [
                Math.round(rgb[0] * 255) / 255,
                Math.round(rgb[1] * 255) / 255,
                Math.round(rgb[2] * 255) / 255,
                1,
              ];
              expect(
                colorContrast(quantized, styleTintEnvelope(fill, foreground).worstForeground)
              ).toBeGreaterThanOrEqual(4.5);
            }
          if (kind === 'original30' && palette === 3 && grid[0] === 224) {
            expect(old.passed).toBe(false);
            expect(next.passed).toBe(false);
            expect(old.frames[0].outputLumaSpan).toBeCloseTo(1.83272, 5);
            expect(old.pair.outputDeltaRms).toBeCloseTo(1.00211, 5);
            expect(next.frames[0].outputLumaSpan).toBeCloseTo(7.17568, 5);
            expect(next.pair.outputDeltaRms).toBeCloseTo(3.91628772181003, 10);
            expect(next.failures).toContain('frame-0:insufficient-detail-amplitude');
            expect(next.failures).toContain('pair:insufficient-source-response');
          }
        }
      });
      expect(oldPassLoss).toBe(0);
      expect([oldPass, nextPass]).toEqual(kind === 'original30' ? [10, 29] : [326, 504]);
      if (kind === 'holdout504') expect(collapsedGains).toBe(168);
    }
  );
  it('retains all twelve 16/80 Toggle controls and rejects full-amplitude unrelated noise', () => {
    let pass = 0,
      rejected = 0;
    for (const [fill, foreground] of frozenPairs)
      for (const checker of [true, false]) {
        const first = Array.from({ length: 192 }, (_, i) => {
          const x = i % 24,
            y = Math.floor(i / 24);
          const high =
            (checker ? Math.floor(x / 4) + Math.floor(y / 4) : 1 + Math.floor(x / 4)) % 2;
          return Array(3).fill((high ? 80 : 16) / 255);
        });
        const sources = [first, first.map((rgb) => rgb.map((c) => 96 / 255 - c))];
        expect(evaluate(sources, outputs(sources, fill, foreground), foreground, 24).passed).toBe(
          true
        );
        pass++;
        const noise = [121, 122].map((seed) => {
          let state = seed;
          const take = () => {
            state ^= state << 13;
            state ^= state >>> 17;
            state ^= state << 5;
            return (state >>> 0) / 2 ** 32;
          };
          return Array.from({ length: 192 }, () => {
            const u = take();
            return u < 1 / 8 ? [0, 0, 0] : u > 7 / 8 ? [1, 1, 1] : [take(), take(), take()];
          });
        });
        const report = evaluate(sources, outputs(noise, fill, foreground), foreground, 24);
        expect(report.passed).toBe(false);
        rejected++;
        for (const frame of report.frames) {
          expect(frame.outputLumaSpan).toBeGreaterThanOrEqual(8);
          expect(frame.minimumForegroundContrast).toBeGreaterThanOrEqual(4.5);
        }
        expect(report.pair.outputDeltaRms).toBeGreaterThanOrEqual(4);
        expect(report.pair.changedCellFraction).toBeGreaterThanOrEqual(0.25);
        expect(report.failures.some((f) => f.includes('unrelated'))).toBe(true);
      }
    expect([pass, rejected]).toEqual([12, 12]);
  });
});

// Frozen first-party v2b proposal, SHA-256
// ec637713214a5177284978bc98256550c8cac9041d82b898934825f71635198a.
// The token hashes exclude only comments/whitespace, preserving every operation,
// coefficient and sequential multiplication. They bind the scalar tests below to
// the proposed GLSL, but do not execute GLSL or establish GPU precision/performance.
const shaderTokens = (source: string) => source.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, '');
const tokenHash = (source: string) =>
  createHash('sha256').update(shaderTokens(source)).digest('hex');
const finalOffsetAnchor = 'vec2 offset = finalOffset;';
const oldOffsetAnchor = 'vec2 offset = refractDir * offsetAmt * centreBlend;';
const mappedAnchor = 'vec2 mapped = u_bounds.xy + flippedUV * u_bounds.zw;';
const refractedAnchor = 'vec2 refracted = mapped + offset - tiltOffset;';
function precisionBranch(source: string, highp: boolean) {
  let enabled = true;
  const stack: { parent: boolean; condition: boolean }[] = [];
  return source
    .split('\n')
    .filter((line) => {
      if (line.trim() === '#ifdef GL_FRAGMENT_PRECISION_HIGH') {
        stack.push({ parent: enabled, condition: highp });
        enabled = enabled && highp;
      } else if (line.trim() === '#else') {
        const frame = stack.at(-1)!;
        enabled = frame.parent && !frame.condition;
      } else if (line.trim() === '#endif') {
        enabled = stack.pop()!.parent;
      } else return enabled;
      return false;
    })
    .join('\n');
}

// Independent scalar budget oracle, intentionally no production CPU counterpart.
// Each channel's four sides are generated as constraints rather than by copying
// the vector GLSL. Its envelope covers regular frost=0/tilt=0/stack-disabled,
// opaque input, LINEAR, radius-3 prefilter and the existing G five-point stencil.
type Vec2 = readonly [number, number];
function sourceBudget(mapped: Vec2, old: Vec2, request: Vec2, aberration: number, size: Vec2) {
  const constraints: { margin: number; delta: number; factor: number }[] = [];
  for (const [multiplier, reach] of [
    [1 - aberration, 3.5],
    [1, 4.5],
    [1 + aberration, 3.5],
    [0, 3.5],
  ]) {
    // Low x, low y, high x, high y, exactly the frozen product ordering.
    for (const high of [false, true])
      for (const axis of [0, 1]) {
        const center = mapped[axis] + multiplier * old[axis];
        const margin = high ? 1 - reach / size[axis] - center : center - reach / size[axis];
        const delta = multiplier * request[axis];
        const positive = Math.max(margin, 0);
        const square = positive * positive;
        const tau = 1 / size[axis];
        constraints.push({ margin, delta, factor: square / (square + delta * delta + tau * tau) });
      }
  }
  const lambda = constraints.reduce((product, constraint) => product * constraint.factor, 1);
  return {
    lambda,
    constraints,
    offset: old.map((value, axis) => value + lambda * request[axis]) as [number, number],
  };
}
function smoothstep(low: number, high: number, value: number) {
  const t = Math.max(0, Math.min(1, (value - low) / (high - low)));
  return t * t * (3 - 2 * t);
}
function tapSafety(mapped: Vec2, offset: Vec2, aberration: number, size: Vec2) {
  const raw = mapped.map((value, axis) => value + offset[axis]);
  const oob = Math.max(-raw[0], raw[0] - 1, -raw[1], raw[1] - 1);
  const blend = 1 - smoothstep(0, 0.01, oob);
  const center = mapped.map((value, axis) => value + offset[axis] * blend);
  const taps = [
    mapped,
    center,
    [center[0] + 1 / size[0], center[1]],
    [center[0] - 1 / size[0], center[1]],
    [center[0], center[1] + 1 / size[1]],
    [center[0], center[1] - 1 / size[1]],
    center.map((value, axis) => value - aberration * offset[axis]),
    center.map((value, axis) => value + aberration * offset[axis]),
  ];
  return taps.map((tap) =>
    tap.every((value, axis) => {
      const index = value * size[axis] - 0.5;
      return Math.floor(index) >= 3 && Math.ceil(index) < size[axis] - 3;
    })
  );
}

describe('profile 6 source gain on all original fixed profile 4/5 inputs (arithmetic only)', () => {
  it.each(['original30', 'holdout504'] as const)(
    'preserves every historical pass and foreground bound on %s without changing inputs or metrics',
    (kind) => {
      const grids =
        kind === 'original30'
          ? frozenGrids
          : frozenLevels.flatMap((a, i) =>
              frozenLevels
                .slice(i + 1)
                .flatMap((b, j) => frozenLevels.slice(i + j + 2).map((c) => [a, b, c]))
            );
      let oldPass = 0,
        nextPass = 0,
        lost = 0;
      for (const [fill, foreground] of frozenPairs)
        for (const grid of grids) {
          const first = grid.flatMap((r) =>
            grid.flatMap((g) => grid.map((b) => [r / 255, g / 255, b / 255]))
          );
          const sources = [first, first.map((_, i) => first[(10 * i + 7) % 27])];
          const bytes = (colors: number[][]) =>
            Uint8Array.from(
              colors.flatMap((color) => [...color.map((c) => Math.round(c * 255)), 255])
            );
          const budget = styleTintSourceTone(bytes(first));
          expect(styleTintSourceTone(bytes(sources[1]))).toEqual(budget);
          const previous = evaluate(sources, outputs(sources, fill, foreground), foreground);
          const mapped = outputs(sources, fill, foreground, false, budget);
          const next = evaluate(sources, mapped, foreground);
          oldPass += Number(previous.passed);
          nextPass += Number(next.passed);
          lost += Number(previous.passed && !next.passed);
          for (const image of mapped)
            for (const rgb of image) {
              const quantized: OpaqueRgba = [
                Math.round(rgb[0] * 255) / 255,
                Math.round(rgb[1] * 255) / 255,
                Math.round(rgb[2] * 255) / 255,
                1,
              ];
              expect(
                colorContrast(quantized, styleTintEnvelope(fill, foreground).worstForeground)
              ).toBeGreaterThanOrEqual(4.5);
            }
        }
      expect(lost).toBe(0);
      expect(oldPass).toBe(kind === 'original30' ? 29 : 504);
      expect(nextPass).toBeGreaterThanOrEqual(oldPass);
    }
  );

  it('retains original Toggle inputs and rejects unrelated full-amplitude noise with the same budget', () => {
    for (const [fill, foreground] of frozenPairs)
      for (const checker of [true, false]) {
        const first = Array.from({ length: 192 }, (_, i) => {
          const x = i % 24,
            y = Math.floor(i / 24);
          const high =
            (checker ? Math.floor(x / 4) + Math.floor(y / 4) : 1 + Math.floor(x / 4)) % 2;
          return Array(3).fill((high ? 80 : 16) / 255);
        });
        const sources = [first, first.map((rgb) => rgb.map((c) => 96 / 255 - c))];
        const budget = styleTintSourceTone(
          Uint8Array.from(first.flatMap((rgb) => [...rgb.map((c) => Math.round(c * 255)), 255]))
        );
        expect(
          evaluate(sources, outputs(sources, fill, foreground, false, budget), foreground, 24)
            .passed
        ).toBe(true);
        const noise = [121, 122].map((seed) => {
          let state = seed;
          const take = () => {
            state ^= state << 13;
            state ^= state >>> 17;
            state ^= state << 5;
            return (state >>> 0) / 2 ** 32;
          };
          return Array.from({ length: 192 }, () => {
            const u = take();
            return u < 1 / 8 ? [0, 0, 0] : u > 7 / 8 ? [1, 1, 1] : [take(), take(), take()];
          });
        });
        const negative = evaluate(
          sources,
          outputs(noise, fill, foreground, false, budget),
          foreground,
          24
        );
        expect(negative.passed).toBe(false);
        expect(negative.failures.some((failure) => failure.includes('unrelated'))).toBe(true);
        expect(negative.pair.outputDeltaRms).toBeGreaterThanOrEqual(4);
        expect(negative.pair.changedCellFraction).toBeGreaterThanOrEqual(0.25);
      }
  });
});

describe('profile 5 frozen source-budgeted shoulder (source/scalar evidence only)', () => {
  it('assembles the exact sixteen-factor proposal before every source tap', () => {
    for (const [profile, neutral] of [
      [styleTintFragment, fragment],
      [styleTintContactFragment, contactFragment],
    ]) {
      const helper = profile.match(
        /#ifdef GL_FRAGMENT_PRECISION_HIGH\s+vec2 budgetSide[\s\S]*?#endif/
      );
      const body = profile.match(/vec2 finalOffset = oldOffset;[\s\S]*?vec2 offset = finalOffset;/);
      expect(helper, 'frozen highp budget helpers').not.toBeNull();
      expect(body, 'frozen final offset block').not.toBeNull();
      expect(tokenHash(helper![0])).toBe(
        '9f84b721dbdd517f24178a2850817ee541eabe728872c3d75e3ff1bf9021fea7'
      );
      expect(tokenHash(body![0])).toBe(
        '2bd366a74dc88e03c819fa49558f4556f9ba5d2fc846b5441391107f8dcf0124'
      );
      expect(profile.split(finalOffsetAnchor)).toHaveLength(2);
      expect(profile).toContain('vec2 oldOffset = refractDir * offsetAmt * centreBlend;');
      expect(profile.indexOf('vec2 finalOffset')).toBeGreaterThan(profile.indexOf(mappedAnchor));
      expect(profile.indexOf(finalOffsetAnchor)).toBeLessThan(profile.indexOf(refractedAnchor));
      const main = profile.slice(profile.indexOf('void main(){'));
      expect(main.indexOf(finalOffsetAnchor)).toBeLessThan(main.indexOf('sampleSource('));
      expect(profile.match(/\bbudgetChannel\(/g)).toHaveLength(5); // definition plus R/G/B/base
      expect(profile.match(/\bsampleSource\(/g)).toHaveLength(
        neutral.match(/\bsampleSource\(/g)!.length
      );
      expect(profile.match(/\btexture2D\(/g)).toHaveLength(neutral.match(/\btexture2D\(/g)!.length);
      expect(profile.match(/\buniform\b/g)).toHaveLength(neutral.match(/\buniform\b/g)!.length + 3);
      expect(profile.slice(profile.indexOf(refractedAnchor), profile.indexOf('vec4 final'))).toBe(
        neutral.slice(neutral.indexOf(refractedAnchor), neutral.indexOf('vec4 final'))
      );
      expect(neutral).not.toContain('budgetSide');
    }
  });
  it('leaves the mediump offset and sampling arithmetic unchanged without precision promotion', () => {
    for (const [profile, neutral] of [
      [styleTintFragment, fragment],
      [styleTintContactFragment, contactFragment],
    ]) {
      const low = precisionBranch(profile, false);
      expect(low).toContain('precision mediump float;');
      expect(low).not.toMatch(/budget(?:Side|Channel|Delta|Lambda)|\bhighp\b/);
      expect(precisionBranch(profile, true)).toContain('precision highp float;');
      const interval = low
        .slice(low.indexOf('vec2 oldOffset'), low.indexOf('vec4 final'))
        .replace('vec2 oldOffset =', 'vec2 offset =')
        .replace('vec2 finalOffset = oldOffset;', '')
        .replace(finalOffsetAnchor, '');
      expect(shaderTokens(interval)).toBe(
        shaderTokens(neutral.slice(neutral.indexOf(oldOffsetAnchor), neutral.indexOf('vec4 final')))
      );
      // Negative control: accidentally removing either budget guard must make
      // the mediump exclusion fail. This is source preprocessing, not a GLSL run.
      for (const block of [
        /#ifdef GL_FRAGMENT_PRECISION_HIGH(\s+vec2 budgetSide[\s\S]*?)#endif/,
        /#ifdef GL_FRAGMENT_PRECISION_HIGH(\s+float budgetShortSide[\s\S]*?)#endif/,
      ]) {
        const leaked = precisionBranch(profile.replace(block, '$1'), false);
        expect(leaked).toMatch(/budget(?:Side|Channel|Delta|Lambda)/);
      }
    }
  });
  it('rejects missing/duplicate/reordered anchors, early source taps and late offset writes', async () => {
    const cases = [
      fragment.replace(oldOffsetAnchor, 'vec2 offset = vec2(0.0);'),
      fragment.replace(oldOffsetAnchor, `${oldOffsetAnchor}\n${oldOffsetAnchor}`),
      fragment.replace(mappedAnchor, 'vec2 mapped = flippedUV;'),
      fragment.replace(mappedAnchor, `${mappedAnchor}\n${mappedAnchor}`),
      fragment.replace(refractedAnchor, ''),
      fragment.replace(refractedAnchor, `${refractedAnchor}\n${refractedAnchor}`),
      fragment
        .replace(mappedAnchor, refractedAnchor)
        .replace(
          refractedAnchor + '\n          ' + refractedAnchor,
          refractedAnchor + '\n          ' + mappedAnchor
        ),
      fragment.replace(mappedAnchor, `${mappedAnchor}\nvec4 early = sampleSource(mapped);`),
      fragment.replace(refractedAnchor, `${refractedAnchor}\noffset += vec2(0.001);`),
      fragment.replace(refractedAnchor, `${refractedAnchor}\noffset.x = 0.001;`),
      fragment.replace(refractedAnchor, `${refractedAnchor}\noffset[0] = 0.001;`),
      fragment.replace(refractedAnchor, `${refractedAnchor}\nmutateOffset(offset);`),
    ];
    try {
      for (const source of cases) {
        vi.resetModules();
        vi.doMock('../src/material/liquidgl-kernel.generated', () => ({ fragment: source }));
        vi.doMock('../src/material/contact-profile', () => ({ contactFragment }));
        await expect(import('../src/material/style-tint-profile')).rejects.toThrow(
          'style-tint-profile-upstream-drift'
        );
      }
    } finally {
      vi.doUnmock('../src/material/liquidgl-kernel.generated');
      vi.doUnmock('../src/material/contact-profile');
      vi.resetModules();
    }
  });
  it('qualifies the stationary base footprint, retaining the independent former twelve-factor counterexample', () => {
    const mapped: Vec2 = [0.5, 2 / 2048],
      old: Vec2 = [0, 0.005],
      request: Vec2 = [0, 0.002],
      size: Vec2 = [512, 2048];
    const result = sourceBudget(mapped, old, request, 0.3, size);
    const before = tapSafety(mapped, old, 0.3, size);
    expect(before[0]).toBe(false);
    expect(before.slice(1).every(Boolean)).toBe(true);
    expect(result.constraints).toHaveLength(16);
    const retiredLambda = result.constraints.slice(0, 12).reduce((value, c) => value * c.factor, 1);
    expect(retiredLambda).toBeGreaterThan(0);
    expect(old[1] + retiredLambda * request[1]).not.toBe(old[1]);
    expect(result.lambda).toBe(0);
    expect(result.offset).toEqual(old);
  });
  it('retains the frozen v1 blue-tap failure as a discriminating pure-widen negative', () => {
    const mapped: Vec2 = [0.016953362358940967, 0.4701605902777778];
    const old: Vec2 = [-0.011521143598473371, 0.006341605984985597];
    const request: Vec2 = [-0.0029678875423285647, 0.0016336202426718255];
    const size: Vec2 = [2048, 512],
      aberration = 0.3;
    const result = sourceBudget(mapped, old, request, aberration, size);
    expect(result.lambda).toBeCloseTo(0.0023071281338214703, 15);
    expect(tapSafety(mapped, old, aberration, size).every(Boolean)).toBe(true);
    expect(tapSafety(mapped, result.offset, aberration, size).every(Boolean)).toBe(true);
    const pure = old.map((value, axis) => value + request[axis]) as [number, number];
    expect(mapped[0] + (1 + aberration) * pure[0]).toBeLessThan(0);
    expect(tapSafety(mapped, pure, aberration, size).at(-1)).toBe(false);
  });
  it('closes every base boundary continuously, including tangential requests with old RGB strictly safe', () => {
    const size: Vec2 = [512, 2048];
    for (const axis of [0, 1])
      for (const sign of [-1, 1])
        for (const tangent of [false, true]) {
          const old: [number, number] = [0.001, 0.001],
            request: [number, number] = [0.002, -0.003];
          old[axis] = sign * 0.02;
          request[axis] = tangent ? 0 : sign * 0.002;
          const slopes: number[] = [];
          for (const epsilon of [-0.1, 0, 0.1, 0.001, 0.00001, 0.0000001]) {
            const mapped: [number, number] = [0.5, 0.5];
            mapped[axis] =
              sign > 0 ? (3.5 + epsilon) / size[axis] : 1 - (3.5 + epsilon) / size[axis];
            const result = sourceBudget(mapped, old, request, 0.3, size);
            expect(tapSafety(mapped, old, 0.3, size).slice(1).every(Boolean)).toBe(true);
            expect(tapSafety(mapped, result.offset, 0.3, size).slice(1).every(Boolean)).toBe(true);
            if (epsilon <= 0) expect(result.offset).toEqual(old);
            else {
              expect(result.lambda).toBeGreaterThan(0);
              slopes.push(
                Math.hypot(...request.map((value, i) => result.lambda * value * size[i])) / epsilon
              );
            }
          }
          expect(slopes[0]).toBeGreaterThan(slopes.at(-1)!);
          expect(slopes.at(-1)).toBeLessThan(0.00001);
        }
  });
  it('retains zero/outer requests and uses shortest-side-relative gate units', () => {
    const short = 38;
    for (const depth of [-1, 0, 2])
      expect(smoothstep((2 / 38) * short, (4 / 38) * short, depth)).toBe(0);
    expect(smoothstep((2 / 38) * short, (4 / 38) * short, 4)).toBe(1);
    // Changing box scale changes the CSS-pixel threshold; these are not universal 2/4px constants.
    expect(smoothstep((2 / 38) * 76, (4 / 38) * 76, 4)).toBe(0);
    const old: Vec2 = [0.01, -0.02];
    expect(sourceBudget([0.5, 0.5], old, [0, 0], 0.3, [512, 2048]).offset).toEqual(old);
  });
  it('preserves every old unsafe point and the half-margin bound in deterministic finite coordinate stress', () => {
    let seed = 20261015;
    const take = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 2 ** 32;
    };
    const lengths = [16, 38, 64, 182, 358, 512, 1024, 2048];
    let unsafe = 0,
      active = 0,
      violations = 0;
    for (let sample = 0; sample < 10000; sample++) {
      const size: Vec2 = [
        lengths[Math.floor(take() * lengths.length)],
        lengths[Math.floor(take() * lengths.length)],
      ];
      const mapped: Vec2 = [take() * 1.1 - 0.05, take() * 1.1 - 0.05];
      const old: Vec2 = [take() * 0.28 - 0.14, take() * 0.28 - 0.14];
      const request: Vec2 = [take() * 0.036 - 0.018, take() * 0.036 - 0.018];
      const aberration = 0.12 + take() * 0.18;
      const result = sourceBudget(mapped, old, request, aberration, size);
      if (!Number.isFinite(result.lambda) || result.lambda < 0 || result.lambda > 1) violations++;
      if (result.constraints.some((constraint) => constraint.margin <= 0)) {
        unsafe++;
        if (result.lambda !== 0 || result.offset.some((value, axis) => value !== old[axis]))
          violations++;
      } else {
        active += Number(result.lambda > 0);
        if (
          result.constraints.some(
            ({ margin, delta }) => Math.abs(result.lambda * delta) > margin / 2
          )
        )
          violations++;
        const before = tapSafety(mapped, old, aberration, size),
          after = tapSafety(mapped, result.offset, aberration, size);
        if (before.some((safe, tap) => safe && !after[tap])) violations++;
      }
    }
    expect(unsafe).toBeGreaterThan(1000);
    expect(active).toBeGreaterThan(1000);
    expect(violations).toBe(0);
  });
});
