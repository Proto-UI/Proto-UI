import { describe, expect, it } from 'vitest';
import { calibratePortalBoundary } from './portal-boundary-calibration';

describe('actual portal boundary calibration', () => {
  it.each([-1, 0, 1])('places edge %s across responsive 2vw padding', async (edge) => {
    const initial = Math.round(1320 + 2 * (1440 * 0.02) + edge);
    // The original one-shot prediction is the observed failing premise: all
    // three controls land above the boundary, rather than below / at / above.
    const initialContent = initial * 0.96;
    expect(initialContent).toBeGreaterThan(1320);
    expect(Math.abs(initialContent - 1320 - edge)).toBeGreaterThan(0.5);
    const result = await calibratePortalBoundary(initial, edge, async (width) => ({
      viewportWidth: width,
      contentWidth: width * 0.96,
      threshold: 1320,
    }));
    expect(result.calibrated).toBe(true);
    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].contentWidth).toBe(initialContent);
    const final = result.samples.at(-1)!;
    expect(final.contentWidth - final.threshold).toBeCloseTo(edge, 0);
    expect(final.contentWidth <= final.threshold).toBe(edge !== 1);
  });

  it('retains all eight failures when a CSS maximum prevents reaching the boundary', async () => {
    const result = await calibratePortalBoundary(1440, 0, async (width) => ({
      viewportWidth: width,
      contentWidth: 1000,
      threshold: 1320,
    }));
    expect(result.calibrated).toBe(false);
    expect(result.samples).toHaveLength(8);
    expect(result.samples.every((sample) => sample.error === -320)).toBe(true);
  });

  it('does not accept the exact 0.5px tolerance boundary', async () => {
    const result = await calibratePortalBoundary(1320, 0, async (width) => ({
      viewportWidth: width,
      contentWidth: width + 0.5,
      threshold: 1320,
    }));
    expect(result.calibrated).toBe(false);
    expect(result.samples).toHaveLength(1);
    expect(result.samples[0].error).toBe(0.5);
  });

  it('rejects a viewport that did not actually change to the requested value', async () => {
    await expect(
      calibratePortalBoundary(1378, 0, async () => ({
        viewportWidth: 1440,
        contentWidth: 1320,
        threshold: 1320,
      }))
    ).rejects.toThrow('Invalid actual boundary measurement');
  });

  it('rejects a missing content measurement instead of declaring convergence', async () => {
    await expect(
      calibratePortalBoundary(1378, 0, async (width) => ({
        viewportWidth: width,
        contentWidth: Number.NaN,
        threshold: 1320,
      }))
    ).rejects.toThrow('Invalid actual boundary measurement');
  });
});
