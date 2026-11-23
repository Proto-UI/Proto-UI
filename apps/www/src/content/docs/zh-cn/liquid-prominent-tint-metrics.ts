import {
  LIQUID_TOGGLE_DETAIL_POLICY,
  type DetailImage,
  type DetailRgb8,
} from './liquid-toggle-detail-metrics';

/** Frozen before native candidate capture. These are engineering diagnostics,
 * not Apple tolerances. The existing structured-detail gate is not replaced.
 * Luma uses encoded sRGB8 Y'=0.2126R+0.7152G+0.0722B. Chroma is diagnostic only:
 * (R-G, B-G) code-value units, NOT a perceptual/color-fidelity acceptance gate. */
export const PROMINENT_TINT_POLICY = Object.freeze({
  ...LIQUID_TOGGLE_DETAIL_POLICY,
  version: 'source-bound-prominent-tint-1',
  maskInsetCss: 4,
  foregroundExclusionCss: 1,
  chromaAcceptance: 'diagnostic-only',
  opaqueChromaIntegrity: 'source/output delta >= 4 encoded difference codes; correlation >= 0.70',
} as const);
export type TintRect = { x: number; y: number; width: number; height: number };
export type TintCell = TintRect;
export type TintPair = readonly [DetailImage, DetailImage];
const mean = (a: readonly number[]) => a.reduce((sum, n) => sum + n, 0) / a.length;
const rms = (a: readonly number[]) => Math.sqrt(mean(a.map((n) => n * n)));
const cosine = (a: readonly number[], b: readonly number[]) => {
  const norm = Math.sqrt(a.reduce((n, v) => n + v * v, 0) * b.reduce((n, v) => n + v * v, 0));
  return norm > 1e-10 ? a.reduce((n, v, i) => n + v * b[i], 0) / norm : 0;
};
const correlation = (a: readonly number[], b: readonly number[]) =>
  cosine(
    a.map((n) => n - mean(a)),
    b.map((n) => n - mean(b))
  );
const span = (a: readonly number[]) => {
  const sorted = [...a].sort((x, y) => x - y);
  const percentile = (p: number) => {
    const at = (sorted.length - 1) * p,
      low = Math.floor(at),
      high = Math.ceil(at);
    return sorted[low] + (sorted[high] - sorted[low]) * (at - low);
  };
  return percentile(0.9) - percentile(0.1);
};
function rectValid(rect: TintRect) {
  return Object.values(rect).every(Number.isFinite) && rect.width > 0 && rect.height > 0;
}
/** Whole four-CSS-pixel cells inside the inset capsule, with actual foreground
 * boxes removed. No control enlargement, edge, shadow, label, icon or check ink.
 * This mask is also applied to carrier-only pixels, even though that plane has
 * no foreground ink. Small/uninformative masks are inconclusive, not passes. */
export function prominentTintCells(
  width: number,
  height: number,
  exclusions: readonly TintRect[],
  hostOffset: { x: number; y: number } = { x: 0, y: 0 }
) {
  if (
    ![width, height].every((n) => Number.isFinite(n) && n > 0) ||
    exclusions.some((r) => !rectValid(r)) ||
    !Object.values(hostOffset).every(Number.isFinite)
  )
    throw new Error('Invalid prominent tint geometry');
  const {
    cellSize: step,
    maskInsetCss: inset,
    foregroundExclusionCss: gap,
  } = PROMINENT_TINT_POLICY;
  const radius = Math.min(width, height) / 2 - inset;
  if (radius <= 0) return [];
  const inside = (x: number, y: number) => {
    const cx = Math.max(inset + radius, Math.min(width - inset - radius, x));
    const cy = Math.max(inset + radius, Math.min(height - inset - radius, y));
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  const cells: TintCell[] = [];
  for (
    let y = Math.ceil((inset + hostOffset.y) / step) * step;
    y + step <= height - inset + hostOffset.y;
    y += step
  )
    for (
      let x = Math.ceil((inset + hostOffset.x) / step) * step;
      x + step <= width - inset + hostOffset.x;
      x += step
    ) {
      const hx = x - hostOffset.x,
        hy = y - hostOffset.y;
      if (
        ![
          [hx, hy],
          [hx + step, hy],
          [hx, hy + step],
          [hx + step, hy + step],
        ].every(([a, b]) => inside(a, b))
      )
        continue;
      if (
        exclusions.some(
          (r) =>
            hx < r.x + r.width + gap &&
            hx + step > r.x - gap &&
            hy < r.y + r.height + gap &&
            hy + step > r.y - gap
        )
      )
        continue;
      cells.push({ x, y, width: step, height: step });
    }
  return cells;
}
function read(image: DetailImage, cells: readonly TintCell[]) {
  if (
    ![image.width, image.height].every((value) => Number.isInteger(value) && value > 0) ||
    image.data.length !== image.width * image.height * 4
  )
    throw new Error('Incomplete prominent tint RGBA image');
  return cells.map((cell) => {
    if (
      !rectValid(cell) ||
      !Object.values(cell).every(Number.isInteger) ||
      cell.x < 0 ||
      cell.y < 0 ||
      cell.x + cell.width > image.width ||
      cell.y + cell.height > image.height
    )
      throw new Error('Invalid prominent tint cell');
    const rgb = [0, 0, 0];
    let opaque = true;
    for (let y = cell.y; y < cell.y + cell.height; y++)
      for (let x = cell.x; x < cell.x + cell.width; x++) {
        const at = (y * image.width + x) * 4;
        for (let c = 0; c < 4; c++)
          if (
            !Number.isFinite(image.data[at + c]) ||
            image.data[at + c] < 0 ||
            image.data[at + c] > 255
          )
            throw new Error('Invalid prominent tint channel');
        for (let c = 0; c < 3; c++) rgb[c] += image.data[at + c] / (cell.width * cell.height);
        opaque &&= image.data[at + 3] === 255;
      }
    return {
      luma: rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722,
      chroma: [rgb[0] - rgb[1], rgb[2] - rgb[1]],
      opaque,
    };
  });
}

/** Constant-field brightness response, separate from structured optical gates.
 * A flat source cannot prove structure/refraction and never passes those gates.
 * Use the same declared opaque interior cells and actual captured byte plane. */
export function measureConstantTintField(image: DetailImage, cells: readonly TintCell[]) {
  if (!cells.length) throw new Error('Empty constant tint cells');
  const values = read(image, cells);
  return {
    cells: values.length,
    fullyOpaque: values.every((value) => value.opaque),
    meanLuma: values.reduce((sum, value) => sum + value.luma, 0) / values.length,
  };
}
function gradients(values: readonly number[], cells: readonly TintCell[]) {
  const index = new Map(cells.map((cell, i) => [`${cell.x},${cell.y}`, i]));
  return cells.flatMap((cell, i) =>
    [
      [cell.x + cell.width, cell.y],
      [cell.x, cell.y + cell.height],
    ].flatMap(([x, y]) => {
      const next = index.get(`${x},${y}`);
      return next === undefined ? [] : [values[next] - values[i]];
    })
  );
}
const delta = (a: readonly number[], b: readonly number[]) => b.map((n, i) => n - a[i]);
export function measureProminentTintPair(
  source: TintPair,
  output: TintPair,
  cells: readonly TintCell[]
) {
  const p = PROMINENT_TINT_POLICY;
  if (
    [...source, ...output].some(
      (image) => image.width !== source[0].width || image.height !== source[0].height
    )
  )
    throw new Error('Prominent tint source/output raster geometry must match');
  // Validate available sampled data before information-quantity classification.
  const sources = source.map((image) => read(image, cells)),
    outputs = output.map((image) => read(image, cells));
  const fullyOpaque = [...sources, ...outputs].every((frame) => frame.every((cell) => cell.opaque));
  if (cells.length < p.minimumCells)
    return {
      status: 'inconclusive' as const,
      reason: 'insufficient-unoccluded-cells',
      cellCount: cells.length,
      fullyOpaque,
      failures: [] as string[],
      frames: [],
      pair: null,
      chroma: null,
    };
  const sy = sources.map((frame) => frame.map((cell) => cell.luma)),
    oy = outputs.map((frame) => frame.map((cell) => cell.luma));
  const sd = delta(sy[0], sy[1]),
    od = delta(oy[0], oy[1]);
  const frames = oy.map((values, i) => ({
    sourceLumaSpan: span(sy[i]),
    outputLumaSpan: span(values),
    spatialCorrelation: correlation(sy[i], values),
    gradientCosine: cosine(gradients(sy[i], cells), gradients(values, cells)),
    fullyOpaque: sources[i].every((c) => c.opaque) && outputs[i].every((c) => c.opaque),
  }));
  // Raw registered ROI pixel changes remain available even when cell luma is
  // uninformative. These channel diagnostics add no candidate acceptance gate.
  const outputPixelDelta = {
    units: 'encoded-sRGB8 per-pixel channel codes, within the declared structure ROI',
    channels: ['R', 'G', 'B'].map((name, channel) => {
      const changes = cells.flatMap((cell) => {
        const values: number[] = [];
        for (let y = cell.y; y < cell.y + cell.height; y++)
          for (let x = cell.x; x < cell.x + cell.width; x++) {
            const at = (y * output[0].width + x) * 4 + channel;
            values.push(output[1].data[at] - output[0].data[at]);
          }
        return values;
      });
      return {
        name,
        rms: rms(changes),
        maximumAbsolute: Math.max(...changes.map(Math.abs)),
        changedPixelFraction: changes.filter((value) => value !== 0).length / changes.length,
      };
    }),
  };
  const pair = {
    outputPixelDelta,
    sourceDeltaRms: rms(sd),
    outputDeltaRms: rms(od),
    deltaCorrelation: correlation(sd, od),
    changedCellFraction: od.filter((n) => Math.abs(n) >= p.changedCellLuma).length / od.length,
  };
  const chroma = {
    units: 'encoded-sRGB8 (R-G,B-G); diagnostic only',
    channels: [0, 1].map((channel) => {
      const a = sources.map((frame) => frame.map((c) => c.chroma[channel])),
        b = outputs.map((frame) => frame.map((c) => c.chroma[channel]));
      return {
        sourceSpan: a.map(span),
        outputSpan: b.map(span),
        sourceDeltaRms: rms(delta(a[0], a[1])),
        outputDeltaRms: rms(delta(b[0], b[1])),
        deltaCorrelation: correlation(delta(a[0], a[1]), delta(b[0], b[1])),
      };
    }),
  };
  const failures: string[] = [];
  frames.forEach((frame, i) => {
    if (!frame.fullyOpaque) failures.push(`frame-${i}:nonopaque-roi`);
    if (frame.outputLumaSpan < p.minimumLumaSpan)
      failures.push(`frame-${i}:insufficient-detail-amplitude`);
    if (frame.spatialCorrelation < p.minimumSpatialCorrelation)
      failures.push(`frame-${i}:unrelated-spatial-structure`);
    if (frame.gradientCosine < p.minimumGradientCosine)
      failures.push(`frame-${i}:unrelated-spatial-gradients`);
  });
  if (pair.outputDeltaRms < p.minimumDeltaRms) failures.push('pair:insufficient-source-response');
  if (pair.deltaCorrelation < p.minimumDeltaCorrelation)
    failures.push('pair:unrelated-source-response');
  if (pair.changedCellFraction < p.minimumChangedFraction)
    failures.push('pair:insufficient-changed-area');
  const informative =
    frames.every((frame) => frame.sourceLumaSpan >= p.minimumLumaSpan) &&
    pair.sourceDeltaRms >= p.minimumDeltaRms;
  return {
    status: !informative
      ? ('inconclusive' as const)
      : failures.length
        ? ('failed' as const)
        : ('passed' as const),
    reason: informative ? null : 'uninformative-source-luminance',
    cellCount: cells.length,
    fullyOpaque,
    failures,
    frames,
    pair,
    chroma,
  };
}
/** A neutral positive control must itself resolve source content. This does not
 * assume regular/Reset and primary share foreground mapping or intrinsic size. */
export function classifyProminentTintEvidence(
  neutral: ReturnType<typeof measureProminentTintPair>,
  tinted: ReturnType<typeof measureProminentTintPair>,
  opaque: ReturnType<typeof measureProminentTintPair>,
  chromaOnly = false
) {
  const controls = [neutral, tinted, opaque];
  if (
    controls.some(
      (control) => !control.fullyOpaque || control.frames.some((frame) => !frame.fullyOpaque)
    )
  )
    return { status: 'invalid-control', reason: 'nonopaque-source-or-output-data' };
  if (
    opaque.status === 'passed' ||
    (opaque.pair &&
      opaque.pair.outputDeltaRms >= PROMINENT_TINT_POLICY.minimumDeltaRms &&
      opaque.pair.deltaCorrelation >= PROMINENT_TINT_POLICY.minimumDeltaCorrelation)
  )
    return { status: 'invalid-control', reason: 'opaque-negative-unexpectedly-source-responsive' };
  // This is only integrity of the opaque negative: a source-responsive opaque
  // surface invalidates collection, including nearly isoluminant source pairs.
  // Reuse the predeclared 4-code/.70 signal floor in encoded (R-G,B-G) units;
  // never require the tinted material to preserve hue or chromatic structure.
  if (
    opaque.chroma?.channels.some(
      (channel) =>
        channel.sourceDeltaRms >= PROMINENT_TINT_POLICY.minimumDeltaRms &&
        channel.outputDeltaRms >= PROMINENT_TINT_POLICY.minimumDeltaRms &&
        channel.deltaCorrelation >= PROMINENT_TINT_POLICY.minimumDeltaCorrelation
    )
  )
    return {
      status: 'invalid-control',
      reason: 'opaque-negative-unexpectedly-source-responsive-chroma',
    };
  if (controls.some((control) => control.cellCount < PROMINENT_TINT_POLICY.minimumCells))
    return { status: 'inconclusive', reason: 'insufficient-unoccluded-cells' };
  if (chromaOnly)
    return {
      status: 'diagnostic-only',
      reason: 'near-isoluminant-chroma-is-not-a-color-fidelity-gate',
    };
  const insufficientNeutral =
    neutral.status === 'inconclusive' ||
    neutral.frames.some((frame) => frame.outputLumaSpan < PROMINENT_TINT_POLICY.minimumLumaSpan) ||
    !neutral.pair ||
    neutral.pair.outputDeltaRms < PROMINENT_TINT_POLICY.minimumDeltaRms ||
    neutral.pair.changedCellFraction < PROMINENT_TINT_POLICY.minimumChangedFraction;
  if (insufficientNeutral)
    return { status: 'inconclusive', reason: 'neutral-reference-has-insufficient-source-signal' };
  if (neutral.status !== 'passed')
    return {
      status: 'invalid-control',
      reason: 'informative-neutral-has-unrelated-structure-or-source-response',
    };

  return { status: tinted.status, reason: tinted.reason };
}
export type { DetailImage, DetailRgb8 };

/** Receipt-only validity; stale source/phase/geometry is never a metric input. */
export function verifyProminentTintBinding(input: {
  optical: boolean;
  sourceRevision: number | null;
  committedSourceRevision: string | null;
  sourceStillCurrent: boolean;
  paintCommitted: boolean;
  snapshotStable: boolean;
  geometryStable: boolean;
}) {
  return (
    input.sourceStillCurrent &&
    input.snapshotStable &&
    input.geometryStable &&
    (!input.optical ||
      (input.paintCommitted &&
        input.sourceRevision !== null &&
        String(input.sourceRevision) === input.committedSourceRevision))
  );
}

/** Known viewport CSS-pixel box, independently fixed before capture. This uses
 * the installed Playwright 1.58.2 enclosingIntRect epsilon convention, then is
 * passed explicitly to page.screenshot (DPR=1, viewport scale=1). No host resize.
 * All source/carrier/native rasters share this box and retain hostOffset. */
export function prominentTintRasterGeometry(host: TintRect) {
  if (!rectValid(host)) throw new Error('Invalid prominent tint host rectangle');
  const x = Math.floor(host.x + 1e-3),
    y = Math.floor(host.y + 1e-3);
  const right = Math.ceil(host.x + host.width - 1e-3),
    bottom = Math.ceil(host.y + host.height - 1e-3);
  const clip = { x, y, width: right - x, height: bottom - y };
  if (clip.width <= 0 || clip.height <= 0) throw new Error('Empty prominent tint raster rectangle');
  return { clip, hostOffset: { x: host.x - x, y: host.y - y } };
}
export function assertProminentTintRaster(
  image: DetailImage,
  registration: ReturnType<typeof prominentTintRasterGeometry>
) {
  if (
    image.width !== registration.clip.width ||
    image.height !== registration.clip.height ||
    image.data.length !== image.width * image.height * 4
  )
    throw new Error('Prominent tint PNG dimensions do not match the explicit screenshot clip');
}
