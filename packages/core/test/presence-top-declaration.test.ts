import { describe, expect, it } from 'vitest';
import { snapshotPresencePresentation } from '../src/presence-presentation';

const recipe = () => ({
  owner: {},
  closed: { top: { px: 0, rootText: 0, containingBlock: -0.25 }, opacity: 0 },
  entered: { top: { px: 0, rootText: 0, containingBlock: 0.1 }, opacity: 1 },
  easing: [0, 0, 1, 1],
  channelEasing: { top: [0, 0, 0.58, 1] },
});
describe('containing-block presence declarations', () => {
  it('snapshots the distinct basis and independent curve without retaining mutable data', () => {
    const input = recipe();
    const copy = snapshotPresencePresentation(input as any);
    input.closed.top.containingBlock = -1;
    input.channelEasing.top[2] = 1;
    expect(copy.closed.top).toEqual({ px: 0, rootText: 0, containingBlock: -0.25 });
    expect(copy.channelEasing?.top).toEqual([0, 0, 0.58, 1]);
    expect(Object.isFrozen(copy.closed.top)).toBe(true);
    expect(Object.isFrozen(copy.channelEasing?.top)).toBe(true);
    expect(copy.owner).toBe(input.owner);
  });
  it.each([
    { px: 0, rootText: 0, ownBox: -0.25 },
    { px: 0, rootText: 0, containingBlock: Infinity },
    { px: 0, containingBlock: -0.25 },
  ])('rejects an own-box substitute or unresolved top coefficient %#', (top) => {
    const input = recipe();
    expect(() =>
      snapshotPresencePresentation({
        ...input,
        closed: { ...input.closed, top },
      } as any)
    ).toThrow('Invalid');
  });
  it.each([
    { scale: [0, 0, 1, 1] },
    { translate: [0, 0, 1, 1] },
    { top: [0, 0, 2, 1] },
    { opacity: new Array(4) },
  ])('rejects undeclared channels and malformed curves %#', (channelEasing) => {
    expect(() => snapshotPresencePresentation({ ...recipe(), channelEasing } as any)).toThrow(
      'Invalid'
    );
  });
  it('does not evaluate getters in top or channel overrides', () => {
    let calls = 0;
    const get = () => {
      calls++;
      return 0;
    };
    const input = recipe();
    Object.defineProperty(input.closed.top, 'containingBlock', { get });
    expect(() => snapshotPresencePresentation(input as any)).toThrow('Invalid');
    const second = recipe();
    Object.defineProperty(second.channelEasing, 'top', { get });
    expect(() => snapshotPresencePresentation(second as any)).toThrow('Invalid');
    expect(calls).toBe(0);
  });
  it('preserves a nonenumerable own-data curve without reading inherited overrides', () => {
    const input = recipe();
    Object.defineProperty(input.channelEasing, 'top', { enumerable: false });
    expect(snapshotPresencePresentation(input as any).channelEasing?.top).toEqual([0, 0, 0.58, 1]);
    const hidden = Object.create({ top: [0, 0, 0.58, 1] });
    expect(
      snapshotPresencePresentation({ ...recipe(), channelEasing: hidden } as any).channelEasing
    ).toEqual({});
  });
});
