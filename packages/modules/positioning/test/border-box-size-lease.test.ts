import { afterEach, describe, expect, it, vi } from 'vitest';
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
afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

describe('neutral used-border-box matching lease', () => {
  it('does not register a successor retired during reference reads or revoke the live predecessor', () => {
    const f = fixture();
    const reference = document.createElement('button');
    let retireOnRead = false,
      nextLive = true;
    Object.defineProperty(reference, 'offsetWidth', {
      get() {
        if (retireOnRead) nextLive = false;
        return 192;
      },
    });
    Object.defineProperty(reference, 'offsetHeight', { get: () => 44 });
    document.body.append(reference);
    const previous = createBorderBoxSizeLease(reference, f.rows, () => true);
    expect(previous.apply().kind).toBe('matched');
    const writes = f.rows.map((row) => vi.spyOn(row.style, 'setProperty'));
    const next = createBorderBoxSizeLease(reference, f.rows, () => nextLive);
    retireOnRead = true;
    expect(next.prepare()).toEqual({ kind: 'unavailable', reason: 'detached-target' });
    for (const write of writes) expect(write).not.toHaveBeenCalled();
    expect(nextLive).toBe(false);
    expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['192px', '44px']);
    retireOnRead = false;
    expect(previous.apply()).toEqual({ kind: 'matched', width: 192, height: 44 });
    previous.restore();
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('does not let an initially pending lease acquire fields from an admitted successor', () => {
    const f = fixture();
    f.resize(0, 0);
    const previous = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(previous.apply().kind).toBe('pending');
    f.resize(192, 44);
    const next = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(next.apply().kind).toBe('matched');
    expect(previous.apply()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['192px', '44px']);
    previous.restore();
    expect(next.verify().kind).toBe('matched');
    next.restore();
    expect(previous.apply()).toEqual({ kind: 'unavailable', reason: 'detached-target' });
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('keeps an initially pending predecessor retired even after its successor restores', () => {
    const f = fixture();
    f.resize(0, 0);
    const previous = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(previous.apply().kind).toBe('pending');
    f.resize(192, 44);
    const next = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(next.apply().kind).toBe('matched');
    next.restore();
    expect(previous.apply()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('does not let a newer pending lease supersede an admitted predecessor before it writes', () => {
    const f = fixture();
    const previous = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(previous.apply().kind).toBe('matched');
    f.resize(0, 0);
    const next = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(next.apply().kind).toBe('pending');
    f.resize(208, 48);
    expect(previous.apply()).toEqual({ kind: 'matched', width: 208, height: 48 });
    expect(next.apply()).toEqual({ kind: 'matched', width: 208, height: 48 });
    expect(previous.verify()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    next.restore();
  });

  it('rejects a partially superseded target set before claiming any of its other targets', () => {
    const f = fixture();
    f.resize(0, 0);
    const previous = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(previous.apply().kind).toBe('pending');
    f.resize(192, 44);
    const next = createBorderBoxSizeLease(f.reference, [f.rows[1]], f.current);
    expect(next.apply().kind).toBe('matched');
    expect(previous.apply()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    expect(f.rows[0].style.cssText).toBe('');
    expect(next.verify().kind).toBe('matched');
    next.restore();
  });

  it.each(['inline-size', 'block-size'] as const)(
    'preserves author %s inserted after prepare even when used dimensions still match',
    (property) => {
      const f = fixture();
      const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
      expect(lease.prepare().kind).toBe('prepared');
      const value = property === 'inline-size' ? '192px' : '44px';
      f.rows[0].style.setProperty(property, value);
      expect(lease.verify()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
      expect(f.rows[0].style.getPropertyValue(property)).toBe(value);
      expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['', '']);
      lease.restore();
      expect(f.rows[0].style.getPropertyValue(property)).toBe(value);
    }
  );

  it('rechecks author logical sizing inserted during used-layout readback', () => {
    const f = fixture();
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.prepare().kind).toBe('prepared');
    Object.defineProperty(f.rows[0], 'offsetWidth', {
      configurable: true,
      get() {
        f.rows[1].style.setProperty('inline-size', '192px');
        return 192;
      },
    });
    expect(lease.verify()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    expect(f.rows[1].style.getPropertyValue('inline-size')).toBe('192px');
    for (const row of f.rows) expect([row.style.width, row.style.height]).toEqual(['', '']);
  });

  it.each([
    [0, 44],
    [192, 0],
    [0, 0],
  ])(
    'keeps missing reference layout %sx%s pending and recovers the same lease',
    (width, height) => {
      const f = fixture();
      f.resize(width, height);
      const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
      expect(lease.apply()).toEqual({ kind: 'pending', reason: 'missing-layout' });
      for (const row of f.rows) expect(row.style.cssText).toBe('');
      f.resize(208, 48);
      expect(lease.apply()).toEqual({ kind: 'matched', width: 208, height: 48 });
      for (const row of f.rows) expect([row.offsetWidth, row.offsetHeight]).toEqual([208, 48]);
      lease.restore();
      for (const row of f.rows) expect(row.style.cssText).toBe('');
    }
  );

  it('does not certify a reference hidden after preparation, then resumes without replacement', () => {
    const f = fixture();
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.prepare().kind).toBe('prepared');
    f.resize(0, 0);
    expect(lease.verify()).toEqual({ kind: 'pending', reason: 'missing-layout' });
    // Previous claims remain ours, not a certified match while layout is absent.
    expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['192px', '44px']);
    f.resize(208, 48);
    expect(lease.apply()).toEqual({ kind: 'matched', width: 208, height: 48 });
    lease.restore();
  });

  it('does not overwrite an author size inserted during the initial pending interval', () => {
    const f = fixture();
    f.resize(0, 0);
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.apply().kind).toBe('pending');
    f.rows[0].style.setProperty('height', '80px', 'important');
    f.resize(192, 44);
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    lease.restore();
    expect(f.rows[0].style.getPropertyValue('height')).toBe('80px');
    expect(f.rows[0].style.getPropertyPriority('height')).toBe('important');
    expect(f.rows[0].style.width).toBe('');
  });

  it('does not reclaim same-valued successor fields after a pending interval', () => {
    const f = fixture();
    const previous = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(previous.apply().kind).toBe('matched');
    f.resize(0, 0);
    expect(previous.apply().kind).toBe('pending');
    f.resize(192, 44);
    const next = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(next.apply().kind).toBe('matched');
    expect(previous.apply()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    previous.restore();
    expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['192px', '44px']);
    next.restore();
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it.each([NaN, Infinity, -1])(
    'keeps invalid reference width %s terminal rather than pending',
    (width) => {
      const f = fixture();
      f.resize(width, 44);
      const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
      expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'invalid-geometry' });
      f.resize(192, 44);
      expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'invalid-geometry' });
      for (const row of f.rows) expect(row.style.cssText).toBe('');
      lease.restore();
    }
  );

  it('keeps a missing target box pending but never certifies a nonfinite used extent', () => {
    const f = fixture();
    let usedWidth = 0;
    Object.defineProperty(f.rows[0], 'offsetWidth', { configurable: true, get: () => usedWidth });
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.apply()).toEqual({ kind: 'pending', reason: 'missing-layout' });
    usedWidth = 192;
    expect(lease.apply()).toEqual({ kind: 'matched', width: 192, height: 44 });
    usedWidth = NaN;
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'invalid-geometry' });
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

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

  it('does not certify prepared sizes before containing layout admits their used boxes', () => {
    const f = fixture();
    let containingWidth = 100;
    Object.defineProperty(f.rows[0], 'offsetWidth', {
      get: () => Math.min(Number.parseFloat(f.rows[0].style.width), containingWidth),
    });
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.prepare()).toEqual({ kind: 'prepared', width: 192, height: 44 });
    expect(f.rows[0].offsetWidth).toBe(100);
    containingWidth = 192;
    expect(lease.apply()).toEqual({ kind: 'matched', width: 192, height: 44 });
    lease.restore();
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('keeps a real height conflict terminal after preparation and restores owned fields', () => {
    const f = fixture();
    Object.defineProperty(f.rows[1], 'offsetHeight', { get: () => 80 });
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.prepare().kind).toBe('prepared');
    expect(lease.apply()).toEqual({ kind: 'unavailable', reason: 'size-conflict' });
    expect(lease.prepare()).toEqual({ kind: 'unavailable', reason: 'size-conflict' });
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('does not certify an author size inserted between preparation and admission', () => {
    const f = fixture();
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.prepare().kind).toBe('prepared');
    f.rows[0].style.setProperty('height', '80px', 'important');
    expect(lease.verify()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    expect(f.rows[0].style.getPropertyValue('height')).toBe('80px');
    expect(f.rows[0].style.getPropertyPriority('height')).toBe('important');
    expect(f.rows[0].style.width).toBe('');
  });

  it('does not rewrite a prepared size when the reference changes before verification', () => {
    const f = fixture();
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.prepare()).toEqual({ kind: 'prepared', width: 192, height: 44 });
    f.resize(208, 48);
    expect(lease.verify()).toEqual({ kind: 'reference-changed' });
    expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['192px', '44px']);
    expect(lease.prepare()).toEqual({ kind: 'prepared', width: 208, height: 48 });
    expect(lease.verify()).toEqual({ kind: 'matched', width: 208, height: 48 });
    lease.restore();
  });

  it('does not certify a prepared claim stolen by a newer lease with the same dimensions', () => {
    const f = fixture();
    const previous = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(previous.prepare().kind).toBe('prepared');
    const next = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(next.apply().kind).toBe('matched');
    expect(previous.verify()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['192px', '44px']);
    next.restore();
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('does not certify a same-valued successor that takes ownership during layout readback', () => {
    const f = fixture();
    const previous = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(previous.prepare().kind).toBe('prepared');
    let next: ReturnType<typeof createBorderBoxSizeLease> | undefined;
    let transferred = false;
    Object.defineProperty(f.rows[0], 'offsetWidth', {
      get() {
        if (!transferred) {
          transferred = true;
          next = createBorderBoxSizeLease(f.reference, f.rows, f.current);
          expect(next.apply().kind).toBe('matched');
        }
        return Number.parseFloat(f.rows[0].style.width);
      },
    });
    expect(previous.verify()).toEqual({ kind: 'unavailable', reason: 'ownership-lost' });
    expect(transferred).toBe(true);
    expect([f.rows[0].style.width, f.rows[0].style.height]).toEqual(['192px', '44px']);
    next!.restore();
    for (const row of f.rows) expect(row.style.cssText).toBe('');
  });

  it('does not certify a target adopted into a different connected document during layout reads', () => {
    const f = fixture();
    const lease = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(lease.prepare().kind).toBe('prepared');
    const foreign = document.implementation.createHTMLDocument('sizing-owned-document-control');
    let adopted = false;
    Object.defineProperty(f.rows[0], 'offsetWidth', {
      get() {
        if (!adopted) {
          adopted = true;
          // This locked DOM requires the public adoption operation explicitly.
          // Assert the real fixture boundary before testing lease certification.
          const moved = foreign.adoptNode(f.rows[1]);
          expect(moved).toBe(f.rows[1]);
          foreign.body.append(moved);
          expect(moved.ownerDocument).toBe(foreign);
          expect(moved.isConnected).toBe(true);
        }
        return Number.parseFloat(f.rows[0].style.width);
      },
    });
    expect(lease.verify()).toEqual({ kind: 'unavailable', reason: 'detached-target' });
    expect(adopted).toBe(true);
    expect(f.rows[1].ownerDocument).toBe(foreign);
    expect(f.rows[1].isConnected).toBe(true);
    for (const row of f.rows) expect(row.style.cssText).toBe('');
    foreign.body.replaceChildren();
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

  it('keeps missing layout pending and rejects a retired generation without writes', () => {
    const f = fixture();
    f.resize(0, 44);
    const pending = createBorderBoxSizeLease(f.reference, f.rows, f.current);
    expect(pending.apply()).toEqual({ kind: 'pending', reason: 'missing-layout' });
    f.resize(192, 44);
    f.retire();
    expect(pending.apply()).toEqual({ kind: 'unavailable', reason: 'detached-target' });
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
