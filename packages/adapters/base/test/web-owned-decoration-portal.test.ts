import { afterEach, expect, it, vi } from 'vitest';
import { beginWebPortalMaterialEpoch } from '../src/platform/portal-destination';
import { createWebOwnedDecorationPortalGate as gate } from '../src/platform/web-owned-decoration-portal';
const host = () => {
  const h = document.createElement('div');
  document.body.append(h);
  return h;
};
afterEach(() => document.body.replaceChildren());
it('waits for the real epoch commit and replays only latest merged paint', () => {
  const h = host(),
    g = gate(h, () => true),
    write = vi.fn(),
    paint = g.wrap(write);
  paint({ kind: 'tw', tokens: ['bg-black'] });
  const e = beginWebPortalMaterialEpoch(h);
  paint({ kind: 'tw', tokens: ['bg-white'] });
  expect(write).not.toHaveBeenCalled();
  e.commitProjection();
  expect(write).toHaveBeenCalledOnce();
  expect(write).toHaveBeenCalledWith({ kind: 'tw', tokens: ['bg-white'] });
  paint({ kind: 'tw', tokens: [] });
  expect(write).toHaveBeenLastCalledWith({ kind: 'tw', tokens: [] });
  g.dispose();
});
it('binds an already committed epoch without reconstructing logical state', () => {
  const h = host(),
    e = beginWebPortalMaterialEpoch(h);
  e.commitProjection();
  const g = gate(h, () => true),
    write = vi.fn();
  g.wrap(write)({ kind: 'tw', tokens: ['bg-black'] });
  expect(write).toHaveBeenCalledOnce();
  g.dispose();
});
it('suspension clears old paint and only a new authoritative epoch can replay', () => {
  const h = host(),
    e = beginWebPortalMaterialEpoch(h),
    g = gate(h, () => true),
    write = vi.fn(),
    paint = g.wrap(write);
  paint({ kind: 'tw', tokens: ['bg-black'] });
  e.commitProjection();
  e.suspend();
  expect(write).toHaveBeenLastCalledWith({ kind: 'tw', tokens: [] });
  const calls = write.mock.calls.length;
  const next = beginWebPortalMaterialEpoch(h);
  next.commitProjection();
  paint({ kind: 'tw', tokens: ['bg-white'] });
  expect(write).toHaveBeenCalledTimes(calls + 2);
  expect(write).toHaveBeenLastCalledWith({ kind: 'tw', tokens: ['bg-white'] });
  expect(g.status().phase).toBe('active');
  g.dispose();
});
it('replacement epoch replays without an old withdrawal', () => {
  const h = host(),
    e = beginWebPortalMaterialEpoch(h),
    g = gate(h, () => true),
    write = vi.fn();
  g.wrap(write)({ kind: 'tw', tokens: ['bg-black'] });
  e.commitProjection();
  beginWebPortalMaterialEpoch(h).commitProjection();
  expect(write).toHaveBeenCalledTimes(2);
  expect(write.mock.calls.every(([value]) => value.tokens.length === 1)).toBe(true);
  g.dispose();
});
it('cross-document adoption never writes to the foreign physical view', () => {
  const h = host(),
    e = beginWebPortalMaterialEpoch(h),
    g = gate(h, () => true),
    write = vi.fn(),
    paint = g.wrap(write);
  paint({ kind: 'tw', tokens: ['bg-black'] });
  e.commitProjection();
  const foreign = document.implementation.createHTMLDocument();
  foreign.body.append(foreign.adoptNode(h));
  expect(h.ownerDocument).toBe(foreign);
  paint({ kind: 'tw', tokens: ['bg-white'] });
  expect(write).toHaveBeenCalledOnce();
  expect(g.status().phase).toBe('retired');
  g.dispose();
});
it('terminal disposal unsubscribes and never writes even during later policy changes', () => {
  const h = host(),
    e = beginWebPortalMaterialEpoch(h),
    g = gate(h, () => true),
    write = vi.fn(),
    paint = g.wrap(write);
  paint({ kind: 'tw', tokens: ['bg-black'] });
  e.commitProjection();
  g.dispose();
  e.suspend();
  paint({ kind: 'tw', tokens: [] });
  expect(write).toHaveBeenCalledOnce();
});
it('a stale physical-view predicate blocks delayed initial projection', () => {
  let current = true;
  const h = host(),
    g = gate(h, () => current),
    write = vi.fn();
  g.wrap(write)({ kind: 'tw', tokens: ['bg-black'] });
  const e = beginWebPortalMaterialEpoch(h);
  current = false;
  e.commitProjection();
  expect(write).not.toHaveBeenCalled();
  g.dispose();
});
it('reentrant replacement stops the old flush before another target is written', () => {
  const h = host(),
    e = beginWebPortalMaterialEpoch(h),
    g = gate(h, () => true),
    second = vi.fn();
  g.wrap(() => beginWebPortalMaterialEpoch(h).commitProjection())({
    kind: 'tw',
    tokens: ['bg-black'],
  });
  g.wrap(second)({ kind: 'tw', tokens: ['bg-white'] });
  e.commitProjection();
  expect(second).not.toHaveBeenCalled();
  g.dispose();
});
it.each(['dispose', 'replace'] as const)(
  'withdraw callback %s cannot revive a retired gate',
  (mode) => {
    const h = host(),
      e = beginWebPortalMaterialEpoch(h),
      g = gate(h, () => true),
      writes: unknown[] = [];
    const paint = g.wrap((value) => {
      writes.push(value);
      if (!value.tokens.length) {
        if (mode === 'dispose') g.dispose();
        else beginWebPortalMaterialEpoch(h).commitProjection();
      }
    });
    paint({ kind: 'tw', tokens: ['bg-black'] });
    e.commitProjection();
    e.release();
    expect(g.status().phase).toBe(mode === 'dispose' ? 'disposed' : 'retired');
    const count = writes.length;
    paint({ kind: 'tw', tokens: ['bg-white'] });
    beginWebPortalMaterialEpoch(h).commitProjection();
    expect(writes).toHaveLength(count);
    g.dispose();
  }
);
