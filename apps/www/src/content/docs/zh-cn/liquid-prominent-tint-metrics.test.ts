// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  PROMINENT_TINT_POLICY,
  prominentTintCells,
  prominentTintRasterGeometry,
  assertProminentTintRaster,
  measureProminentTintPair,
  measureConstantTintField,
  classifyProminentTintEvidence,
  verifyProminentTintBinding,
  type DetailImage,
  type TintPair,
} from './liquid-prominent-tint-metrics';
const width = 100,
  height = 40,
  cells = prominentTintCells(width, height, [{ x: 36, y: 10, width: 28, height: 20 }]);
function image(fn: (x: number, y: number) => number[]): DetailImage {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) data.set([...fn(x, y), 255], (y * width + x) * 4);
  return { width, height, data };
}
const sources = [0, 1].map((phase) =>
  image((x) => {
    const v = (Math.floor(x / 25) + phase) % 2 ? 140 : 40;
    return [v, v, v];
  })
) as unknown as TintPair;
function mapPair(fn: (v: number, x: number, y: number, i: number) => number[]): TintPair {
  return sources.map((src, i) =>
    image((x, y) => fn(src.data[(y * width + x) * 4], x, y, i))
  ) as unknown as TintPair;
}
const positive = mapPair((v) => [10 + v * 0.6, 20 + v * 0.6, 40 + v * 0.6]);
const flat = mapPair(() => [0, 97, 204]);
const evaluate = (output: TintPair) => measureProminentTintPair(sources, output, cells);
describe('predeclared prominent tint source response diagnostics', () => {
  it('measures actual constant-field brightness without relabeling it as structured optics', () => {
    const first = measureConstantTintField(
      image(() => [32, 32, 32]),
      cells
    );
    const second = measureConstantTintField(
      image(() => [96, 96, 96]),
      cells
    );
    expect(first.fullyOpaque).toBe(true);
    expect(first.meanLuma).toBeCloseTo(32, 12);
    expect(second.meanLuma - first.meanLuma).toBeCloseTo(64, 12);
    expect(measureConstantTintField(flat[0], cells)).toEqual(
      measureConstantTintField(flat[1], cells)
    );
    expect(() => measureConstantTintField(flat[0], [])).toThrow('Empty');
    const transparent = image(() => [32, 32, 32]);
    const transparentBytes = Uint8Array.from(transparent.data);
    transparentBytes[(cells[0].y * width + cells[0].x) * 4 + 3] = 254;
    expect(
      measureConstantTintField({ ...transparent, data: transparentBytes }, cells).fullyOpaque
    ).toBe(false);
  });
  it('preserves structured/luma thresholds and declares chroma diagnostic-only', () => {
    expect(PROMINENT_TINT_POLICY).toMatchObject({
      minimumLumaSpan: 8,
      minimumDeltaRms: 4,
      minimumSpatialCorrelation: 0.7,
      minimumGradientCosine: 0.6,
      minimumDeltaCorrelation: 0.7,
      minimumChangedFraction: 0.25,
      minimumContrast: 4.5,
      chromaAcceptance: 'diagnostic-only',
    });
    expect(Object.isFrozen(PROMINENT_TINT_POLICY)).toBe(true);
  });
  it('accepts a source-responsive independent positive before native sampling', () => {
    expect(evaluate(positive).status).toBe('passed');
    expect(cells.length).toBeGreaterThanOrEqual(16);
  });
  it('rejects pure fill regardless of source changes', () => {
    expect(evaluate(flat).status).toBe('failed');
    expect(evaluate(flat).failures).toContain('pair:insufficient-source-response');
  });
  it('rejects unrelated deterministic multicolor noise', () => {
    const noise = mapPair((_v, x, y, i) => [
      (x * 37 + y * 73 + i * 29) % 127,
      (x * 17 + y * 61 + i * 53) % 127,
      (x * 83 + y * 23 + i * 97) % 127,
    ]);
    expect(evaluate(noise).status).toBe('failed');
  });
  it('rejects old flattened multiplicative style tint', () => {
    const linear = (n: number) => {
      const v = n / 255;
      return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    const srgb = (v: number) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
    const old = mapPair((v) =>
      [0, 97, 204].map((fill) => srgb(linear(fill) * (0.68 + (0.32 * v) / 255)))
    );
    expect(evaluate(old).status).toBe('failed');
    expect(evaluate(old).failures.some((s) => s.includes('insufficient-detail-amplitude'))).toBe(
      true
    );
  });
  it('does not make uninformative neutral evidence a pass', () => {
    expect(
      classifyProminentTintEvidence(evaluate(flat), evaluate(positive), evaluate(flat)).status
    ).toBe('inconclusive');
    const gray = [image(() => [80, 80, 80]), image(() => [80, 80, 80])] as TintPair;
    expect(measureProminentTintPair(gray, gray, cells).status).toBe('inconclusive');
  });
  it('keeps near-isoluminant chroma diagnostic even when color structure changes', () => {
    expect(
      classifyProminentTintEvidence(evaluate(positive), evaluate(flat), evaluate(flat), true).status
    ).toBe('diagnostic-only');
  });
  it('rejects a near-isoluminant source-responsive opaque negative before chroma diagnosis', () => {
    const chromatic = [0, 1].map((phase) =>
      image((x) => ((Math.floor(x / 25) + phase) % 2 ? [120, 80, 80] : [80, 92, 80]))
    ) as unknown as TintPair;
    const copied = measureProminentTintPair(chromatic, chromatic, cells);
    expect(copied.pair!.sourceDeltaRms).toBeLessThan(1);
    expect(copied.status).toBe('inconclusive');
    expect(copied.pair!.outputPixelDelta.channels[0]).toMatchObject({
      name: 'R',
      rms: 40,
      maximumAbsolute: 40,
      changedPixelFraction: 1,
    });
    expect(classifyProminentTintEvidence(copied, copied, copied, true)).toEqual({
      status: 'invalid-control',
      reason: 'opaque-negative-unexpectedly-source-responsive-chroma',
    });
  });
  it('keeps fixed opaque with arbitrary tinted chroma diagnostic-only', () => {
    const chromatic = [0, 1].map((phase) =>
      image((x) => ((Math.floor(x / 25) + phase) % 2 ? [120, 80, 80] : [80, 92, 80]))
    ) as unknown as TintPair;
    const neutral = measureProminentTintPair(chromatic, chromatic, cells);
    const opaque = measureProminentTintPair(chromatic, flat, cells);
    expect(
      opaque.pair!.outputPixelDelta.channels.every(
        (channel) => channel.rms === 0 && channel.changedPixelFraction === 0
      )
    ).toBe(true);
    for (const output of [chromatic, [chromatic[1], chromatic[0]], flat] as TintPair[])
      expect(
        classifyProminentTintEvidence(
          neutral,
          measureProminentTintPair(chromatic, output, cells),
          opaque,
          true
        ).status
      ).toBe('diagnostic-only');
  });
  it('excludes actual foreground bounding boxes plus one pixel and the capsule edge', () => {
    for (const cell of cells) {
      expect(
        cell.x + cell.width <= 35 || cell.x >= 65 || cell.y + cell.height <= 9 || cell.y >= 31
      ).toBe(true);
      expect(cell.x).toBeGreaterThanOrEqual(4);
      expect(cell.y).toBeGreaterThanOrEqual(4);
    }
    expect(prominentTintCells(28, 28, [{ x: 0, y: 0, width: 28, height: 28 }])).toEqual([]);
  });
  it('does not let border/label-only multicolor structure supply evidence', () => {
    const occupied = new Set(
      cells.flatMap((c) =>
        Array.from({ length: 16 }, (_, i) => `${c.x + (i % 4)},${c.y + Math.floor(i / 4)}`)
      )
    );
    const decorated = mapPair((v, x, y) =>
      occupied.has(`${x},${y}`) ? [0, 97, 204] : [v, 255 - v, (2 * v) % 255]
    );
    expect(evaluate(decorated).status).toBe('failed');
  });
  it('rejects unregistered dimensions, invalid channels, and alpha', () => {
    expect(() =>
      measureProminentTintPair(sources, [{ ...positive[0], width: 99 }, positive[1]], cells)
    ).toThrow(/geometry/);
    const invalid = { ...positive[0], data: Array.from(positive[0].data) };
    const first = cells[0];
    invalid.data[(first.y * width + first.x) * 4] = NaN;
    expect(() => evaluate([invalid, positive[1]])).toThrow(/channel/);
    invalid.data[(first.y * width + first.x) * 4] = 0;
    invalid.data[(first.y * width + first.x) * 4 + 3] = 0;
    expect(evaluate([invalid, positive[1]]).failures).toContain('frame-0:nonopaque-roi');
  });
  it('retains insufficient real small-content area as inconclusive', () => {
    expect(measureProminentTintPair(sources, positive, []).status).toBe('inconclusive');
  });
  it('rejects a source-independent highlight despite visible variation', () => {
    const highlight = mapPair((_v, x) => [x, x, x]);
    expect(evaluate(highlight).failures).toContain('pair:insufficient-source-response');
  });
  it('rejects one-code perfectly correlated response', () => {
    const weak = mapPair((v) => [20 + v / 100, 30 + v / 100, 40 + v / 100]);
    expect(evaluate(weak).status).toBe('failed');
    expect(evaluate(weak).failures).toContain('pair:insufficient-source-response');
  });
  it('rejects stale source-carrier revision, phase, and geometry binding', () => {
    const valid = {
      optical: true,
      sourceRevision: 3,
      committedSourceRevision: '3',
      sourceStillCurrent: true,
      paintCommitted: true,
      snapshotStable: true,
      geometryStable: true,
    };
    expect(verifyProminentTintBinding(valid)).toBe(true);
    for (const patch of [
      { committedSourceRevision: '2' },
      { sourceStillCurrent: false },
      { paintCommitted: false },
      { snapshotStable: false },
      { geometryStable: false },
    ])
      expect(verifyProminentTintBinding({ ...valid, ...patch })).toBe(false);
  });
  it('accepts independent low-frequency blurred response and rejects wrong spatial registration', () => {
    const blur = mapPair((_v, x, y, i) => {
      let sum = 0;
      for (let dx = -2; dx <= 2; dx++)
        sum += sources[i].data[(y * width + Math.max(0, Math.min(width - 1, x + dx))) * 4] / 5;
      return [10 + 0.6 * sum, 20 + 0.6 * sum, 40 + 0.6 * sum];
    });
    expect(evaluate(blur).status).toBe('passed');
    const wrong = mapPair((_v, x, y, i) => {
      const v = sources[i].data[(y * width + ((x + 25) % width)) * 4];
      return [10 + 0.6 * v, 20 + 0.6 * v, 40 + 0.6 * v];
    });
    expect(evaluate(wrong).status).toBe('failed');
  });
  it('registers fractional host geometry to the declared integer screenshot rectangle', () => {
    expect(prominentTintRasterGeometry({ x: 10.75, y: 20.25, width: 20.5, height: 10.5 })).toEqual({
      clip: { x: 10, y: 20, width: 22, height: 11 },
      hostOffset: { x: 0.75, y: 0.25 },
    });
    const a = prominentTintRasterGeometry({ x: 10.25, y: 20.25, width: 20.5, height: 10.5 });
    const b = prominentTintRasterGeometry({ x: 10.5, y: 20.5, width: 20.5, height: 10.5 });
    expect(a.clip).toEqual(b.clip);
    expect(a.hostOffset).not.toEqual(b.hostOffset);
  });
  it('does not let weak neutral mask a source-responsive opaque control', () => {
    expect(
      classifyProminentTintEvidence(evaluate(flat), evaluate(positive), evaluate(positive)).status
    ).toBe('invalid-control');
  });
  it('does not relabel invalid alpha or unrelated informative neutral as insufficient information', () => {
    const measured = evaluate(positive);
    expect(measured.status).toBe('passed');
    if (measured.pair === null || measured.frames.length !== 2)
      throw new Error('The positive control must have a measured pair and both frames');
    const malformed = {
      ...measured,
      frames: measured.frames.map((frame) => ({ ...frame, fullyOpaque: false })),
    };
    expect(
      classifyProminentTintEvidence(malformed, evaluate(positive), evaluate(flat)).status
    ).toBe('invalid-control');
    const unrelated = {
      ...measured,
      status: 'failed' as const,
      failures: ['frame-0:unrelated-spatial-structure'],
    };
    expect(
      classifyProminentTintEvidence(unrelated, evaluate(positive), evaluate(flat)).status
    ).toBe('invalid-control');
  });
  it('does not hide malformed or nonopaque sampled data behind too few cells', () => {
    const damaged = { ...positive[0], data: Uint8Array.from(positive[0].data) };
    damaged.data[(cells[0].y * width + cells[0].x) * 4 + 3] = 0;
    const small = measureProminentTintPair(sources, [damaged, positive[1]], cells.slice(0, 1));
    expect(classifyProminentTintEvidence(small, evaluate(positive), evaluate(flat)).status).toBe(
      'invalid-control'
    );
    expect(() =>
      measureProminentTintPair(
        sources,
        [{ ...positive[0], data: new Uint8Array(0) }, positive[1]],
        []
      )
    ).toThrow(/RGBA/);
  });
  it('diagnostic chroma never suppresses invalid independent controls', () => {
    expect(
      classifyProminentTintEvidence(evaluate(flat), evaluate(positive), evaluate(positive), true)
        .status
    ).toBe('invalid-control');
  });

  it('keeps whole four-pixel cells on the integer raster while testing fractional host coordinates', () => {
    const offset = { x: 0.75, y: 0.25 },
      excluded = { x: 36.5, y: 10.25, width: 28.5, height: 20.25 };
    const rasterCells = prominentTintCells(100.5, 40.5, [excluded], offset);
    expect(rasterCells.length).toBeGreaterThanOrEqual(16);
    for (const cell of rasterCells) {
      expect(Object.values(cell).every(Number.isInteger)).toBe(true);
      expect(cell.x % 4).toBe(0);
      expect(cell.y % 4).toBe(0);
      const x = cell.x - offset.x,
        y = cell.y - offset.y;
      expect(
        x + cell.width <= excluded.x - 1 ||
          x >= excluded.x + excluded.width + 1 ||
          y + cell.height <= excluded.y - 1 ||
          y >= excluded.y + excluded.height + 1
      ).toBe(true);
    }
  });
  it('accepts exactly declared native PNG pixels and rejects both larger and smaller rasters', () => {
    const registration = prominentTintRasterGeometry({
      x: 10.75,
      y: 20.25,
      width: 20.5,
      height: 10.5,
    });
    const raster = { width: 22, height: 11, data: new Uint8Array(22 * 11 * 4) };
    expect(() => assertProminentTintRaster(raster, registration)).not.toThrow();
    for (const [width, height] of [
      [21, 11],
      [23, 11],
      [22, 10],
      [22, 12],
    ])
      expect(() =>
        assertProminentTintRaster(
          { width, height, data: new Uint8Array(width * height * 4) },
          registration
        )
      ).toThrow(/PNG dimensions/);
    expect(() =>
      assertProminentTintRaster({ ...raster, data: new Uint8Array(1) }, registration)
    ).toThrow(/PNG dimensions/);
  });
});
