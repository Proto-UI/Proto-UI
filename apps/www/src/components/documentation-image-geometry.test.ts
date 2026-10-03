import { describe, expect, it } from 'vitest';
import { imageContainRect, imageOriginTransform } from './documentation-image-geometry';
const viewport = { x: 0, y: 0, width: 1280, height: 900 };
describe('image viewport geometry / #796', () => {
  it.each([
    [1600, 900],
    [300, 1200],
    [100, 100],
  ])('contains %s × %s without distorting its ratio', (width, height) => {
    const rect = imageContainRect(width, height, viewport);
    expect(rect.x).toBeGreaterThanOrEqual(16);
    expect(rect.y).toBeGreaterThanOrEqual(16);
    expect(rect.x + rect.width).toBeLessThanOrEqual(1264);
    expect(rect.y + rect.height).toBeLessThanOrEqual(884);
    expect(rect.width / rect.height).toBeCloseTo(width / height);
  });
  it('uses the visual viewport offset and handles unknown dimensions safely', () => {
    expect(imageContainRect(0, 0, { x: 30, y: 40, width: 320, height: 600 })).toEqual({
      x: 46,
      y: 196,
      width: 288,
      height: 288,
    });
  });
  it('maps the actual original rectangle to the contained rectangle', () => {
    expect(
      imageOriginTransform(
        { x: 20, y: 40, width: 300, height: 200 },
        { x: 100, y: 120, width: 900, height: 600 },
        viewport
      )
    ).toBe('translate(-80px, -80px) scale(0.3333333333333333, 0.3333333333333333)');
  });
  it.each([
    null,
    { x: 0, y: 0, width: 0, height: 20 },
    { x: 0, y: 0, width: Infinity, height: 20 },
    { x: -400, y: 0, width: 300, height: 200 },
    { x: 0, y: 901, width: 300, height: 200 },
  ])('falls back for an absent or unusable origin %s', (origin) => {
    expect(imageOriginTransform(origin, imageContainRect(400, 200, viewport), viewport)).toBeNull();
  });
});
