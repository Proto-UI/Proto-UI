import { afterEach, describe, expect, it, vi } from 'vitest';
import { readBorderOutline, rectangleInsideBorder } from '../src/material/border-outline';
import {
  connectWebMaterialPaintReservation,
  updateWebMaterialPaintReservation,
} from '../src/material/paint-reservation';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});
const rect = (x: number, y: number, width: number, height: number) =>
  new DOMRect(x, y, width, height);
function outline() {
  const item = document.createElement('div');
  item.style.cssText = 'border-width:1px;border-style:solid;border-color:#222;border-radius:16px';
  document.body.append(item);
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  vi.spyOn(item, 'getBoundingClientRect').mockReturnValue(rect(4, 40, 504, 186));
  return item;
}

describe('ordinary ancestor border admission (injected geometry, not native paint)', () => {
  it('rejects the original rounded-corner overlap despite rectangular border clearance', () => {
    const item = outline();
    const read = readBorderOutline(item);
    expect(read.status).toBe('border');
    if (read.status !== 'border') throw new Error('missing border');
    expect(read.blockClearance).toEqual({ top: 16, bottom: 16 });
    expect(rectangleInsideBorder({ left: 5, top: 41, right: 507, bottom: 161 }, read.border)).toBe(
      false
    );
    expect(rectangleInsideBorder({ left: 5, top: 57, right: 507, bottom: 177 }, read.border)).toBe(
      true
    );
    expect(
      rectangleInsideBorder({ left: 4.9, top: 57, right: 507, bottom: 177 }, read.border)
    ).toBe(false);
  });

  it('does not parse unknown/percentage radii as pixels or omit other outline paint', () => {
    const item = outline();
    for (const value of ['50%', '12px 40%']) {
      item.style.borderRadius = value;
      expect(readBorderOutline(item).status).toBe('unsupported');
    }
    item.style.borderRadius = '0';
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 2 });
    expect(readBorderOutline(item)).toMatchObject({ blockClearance: { top: 0.5, bottom: 0.5 } });
    item.style.boxShadow = '0 0 4px #000';
    expect(readBorderOutline(item).status).toBe('unsupported');
  });

  it('normalizes overlapping elliptical used radii before deriving inner corners', () => {
    const item = outline();
    item.style.borderRadius = '100px 20px';
    vi.mocked(item.getBoundingClientRect).mockReturnValue(rect(0, 0, 100, 100));
    const read = readBorderOutline(item);
    expect(read.status).toBe('border');
    if (read.status !== 'border') throw new Error('missing border');
    expect(read.border.corners.tl.x).toBeCloseTo(100 * (100 / 120) - 1);
  });

  it('adds explicit block clearance without changing the profile ROI and revokes changed outlines', () => {
    const item = outline();
    const part = document.createElement('div');
    const target = document.createElement('button');
    item.append(part);
    part.append(target);
    const number = (name: string) => parseFloat(part.style.getPropertyValue(name) || '0');
    vi.spyOn(part, 'getBoundingClientRect').mockImplementation(() =>
      rect(
        5,
        41,
        430 + number('padding-left') + number('padding-right'),
        48 + number('padding-top') + number('padding-bottom')
      )
    );
    vi.spyOn(target, 'getBoundingClientRect').mockImplementation(() =>
      rect(5 + number('padding-left'), 41 + number('padding-top'), 430, 48)
    );
    vi.mocked(item.getBoundingClientRect).mockImplementation(() =>
      rect(
        4,
        40,
        432 + number('padding-left') + number('padding-right'),
        50 + number('padding-top') + number('padding-bottom')
      )
    );
    const release = connectWebMaterialPaintReservation(target, part, {}, () => true, null, item);
    const fact = {
      view: 1,
      revision: 1,
      profile: 'test',
      edges: { top: 36, right: 36, bottom: 36, left: 36 },
    };
    expect(updateWebMaterialPaintReservation(target, fact)).toMatchObject({
      reason: 'paint-reservation-layout-pending',
    });
    expect(part.style.paddingTop).toBe('52px');
    expect(part.style.paddingRight).toBe('36px');
    const ready = updateWebMaterialPaintReservation(target, fact);
    expect(ready.status).toBe('ready');
    expect(ready.status === 'ready' && ready.footprint.edges).toEqual(fact.edges);
    expect(ready.status === 'ready' && ready.current()).toBe(true);
    item.style.borderRadius = '24px';
    expect(ready.status === 'ready' && ready.current()).toBe(false);
    expect(item.style.borderRadius).toBe('24px');
    release();
    expect(item.style.borderRadius).toBe('24px');
    expect(part.style.padding).toBe('');
  });
});
