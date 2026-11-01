import { afterEach, describe, expect, it } from 'vitest';
import {
  createBorderBoxSizeLease,
  measureBorderBoxInlineGutter,
} from '../src/web/border-box-size-lease';

// This harness supplies deterministic layout facts; it is NOT native browser
// geometry evidence. The separate browser matrix must measure actual boxes.
function measuredRow() {
  const row = document.createElement('div');
  for (const [key, dimension] of [
    ['offsetWidth', 'width'],
    ['clientWidth', 'width'],
    ['scrollWidth', 'width'],
    ['offsetHeight', 'height'],
    ['clientHeight', 'height'],
    ['scrollHeight', 'height'],
  ] as const)
    Object.defineProperty(row, key, {
      configurable: true,
      get: () => Number.parseFloat(row.style[dimension]) || 32,
    });
  return row;
}
function fixture() {
  const reference = document.createElement('button');
  const rows = [measuredRow(), measuredRow()];
  let width = 192,
    height = 44,
    live = true;
  Object.defineProperty(reference, 'offsetWidth', { get: () => width });
  Object.defineProperty(reference, 'offsetHeight', { get: () => height });
  document.body.append(reference, ...rows);
  return {
    reference,
    rows,
    current: () => live,
    resize(w: number, h: number) {
      width = w;
      height = h;
    },
    retire() {
      live = false;
    },
  };
}
afterEach(() => document.body.replaceChildren());

describe('neutral used-border-box matching lease', () => {
  it('matches every declared row to 192x44 and follows layout resize', () => {
    const f = fixture(),
      lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.apply()).toEqual({ kind: 'matched', width: 192, height: 44 });
    for (const row of f.rows) expect([row.offsetWidth, row.offsetHeight]).toEqual([192, 44]);
    f.resize(208, 48);
    expect(lease.apply()).toEqual({ kind: 'matched', width: 208, height: 48 });
    lease.restore();
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('ignores trigger press and ancestor paint-scale BCR changes', () => {
    const f = fixture();
    f.reference.getBoundingClientRect = () => {
      throw new Error('paint geometry must not size rows');
    };
    f.reference.style.transform = 'scale(0.95)';
    document.body.style.transform = 'scale(2)';
    try {
      const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
      expect(lease.apply()).toEqual({ kind: 'matched', width: 192, height: 44 });
      lease.restore();
    } finally {
      document.body.style.transform = '';
    }
  });

  it.each(['width', 'height'] as const)('preserves initial authored %s !important', (property) => {
    const f = fixture();
    f.rows[0].style.setProperty(property, '75px', 'important');
    const before = f.rows.map((row) => row.style.cssText);
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'size-conflict' });
    expect(f.rows.map((row) => row.style.cssText)).toEqual(before);
  });

  it('preserves an explicit normal inline size until the caller selects intrinsic', () => {
    const f = fixture();
    f.rows[0].style.width = '75px';
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'size-conflict' });
    expect(f.rows[0].style.width).toBe('75px');
    expect(f.rows[1].style.width).toBe('');
  });

  it('withdraws partial writes when a used min-size constraint prevents matching', () => {
    const f = fixture();
    Object.defineProperty(f.rows[1], 'offsetHeight', { get: () => 80 });
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'size-conflict' });
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it.each(['scrollWidth', 'scrollHeight'] as const)(
    'does not hide overflowing content on %s',
    (property) => {
      const f = fixture();
      Object.defineProperty(f.rows[1], property, { get: () => 400 });
      const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
      expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'size-conflict' });
      for (const row of f.rows) expect(row.style.cssText).toBe('');
    }
  );

  it('preserves later author writes and restores the remaining fields on ownership loss', () => {
    const f = fixture(),
      lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.apply().kind).toBe('matched');
    f.rows[0].style.setProperty('width', '75px', 'important');
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    expect(f.rows[0].style.width).toBe('75px');
    expect(f.rows[0].style.getPropertyPriority('width')).toBe('important');
    expect(f.rows[0].style.height).toBe('');
    expect(f.rows[1].style.cssText).toBe('');
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
  });

  it('does not let an older cleanup erase the next current lease', () => {
    const f = fixture(),
      old = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(old.apply().kind).toBe('matched');
    const next = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(next.apply().kind).toBe('matched');
    old.restore();
    expect(f.rows[0].style.width).toBe('192px');
    next.restore();
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('rejects missing layout geometry and a retired generation without writes', () => {
    const f = fixture();
    f.resize(0, 44);
    const invalid = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(invalid.apply()).toEqual({ kind: 'unavailable', reason: 'invalid-geometry' });
    f.resize(192, 44);
    f.retire();
    const retired = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(retired.apply()).toEqual({ kind: 'unavailable', reason: 'detached-target' });
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('accounts for two borders, viewport padding and a reserved scrollbar outside each row', () => {
    const surface = document.createElement('div'),
      viewport = document.createElement('div'),
      row = document.createElement('div');
    surface.style.cssText = 'border:1px solid;padding:0;margin:0;';
    viewport.style.cssText = 'border:0;padding:0 4px;margin:0;';
    row.style.margin = '0';
    surface.append(viewport);
    viewport.append(row);
    document.body.append(surface);
    for (const [node, width, client] of [
      [surface, 217, 215],
      [viewport, 215, 200],
    ] as const) {
      Object.defineProperty(node, 'offsetWidth', { value: width });
      Object.defineProperty(node, 'clientWidth', { value: client });
    }
    expect(measureBorderBoxInlineGutter(row, surface)).toBe(25);
    expect(192 + measureBorderBoxInlineGutter(row, surface)!).toBe(217);
  });
});
