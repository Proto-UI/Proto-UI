import { describe, expect, it } from 'vitest';
import { computedRgbAlpha } from './scroll-area-corner-color';

describe('Scroll Area computed RGB alpha observation', () => {
  it.each([
    'rgba(0, 0, 0, 0)',
    'rgba(255, 255, 255, 0)',
    'rgb(255 255 255 / 0)',
    'rgba(100% 100% 100% / 0%)',
    'transparent',
  ])('accepts transparent %s independently of RGB channels', (color) => {
    expect(computedRgbAlpha(color)).toBe(0);
  });
  it.each(['rgb(0, 0, 0)', 'rgb(0 0 0)', 'rgba(0, 0, 0, 1)', 'rgba(0 0 0 / 100%)'])(
    'retains opaque %s',
    (color) => {
      expect(computedRgbAlpha(color)).toBe(1);
    }
  );
  it.each(['rgba(0, 0, 0, 0.1)', 'rgb(255 255 255 / 10%)'])(
    'does not erase nonzero alpha in %s',
    (color) => {
      expect(computedRgbAlpha(color)).toBe(0.1);
    }
  );
  it.each([
    'rgb(0 0 / 0)',
    'rgba(0, 0, 0, bad)',
    'rgb(0 0 0 / 0 / 1)',
    'color(display-p3 0 0 0 / 0)',
    'rgba(0, 0, 0, -1)',
    'rgba(0, 0, 0, 2)',
  ])('withholds unsupported or malformed %s', (color) => {
    expect(computedRgbAlpha(color)).toBeNull();
  });
});
