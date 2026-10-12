import { describe, expect, it } from 'vitest';
import { snapshotResidentMotion } from '../src/resident-motion';
const valid = () => ({ properties: ['translate'], durationMs: 100, easing: [0, 0, 1, 1] });
describe('resident motion declaration snapshots', () => {
  it('rejects sparse easing on the first normalization', () =>
    expect(() => snapshotResidentMotion({ ...valid(), easing: new Array(4) } as any)).toThrow(
      'Invalid declaration'
    ));
  it('rejects sparse properties', () =>
    expect(() => snapshotResidentMotion({ ...valid(), properties: new Array(1) } as any)).toThrow(
      'Invalid declaration'
    ));
  it.each([NaN, Infinity, -Infinity])('rejects non-finite curve coordinate %s', (n) =>
    expect(() => snapshotResidentMotion({ ...valid(), easing: [0, n, 1, 1] } as any)).toThrow(
      'Invalid declaration'
    )
  );
  it('rejects coordinate accessors without invoking them', () => {
    let reads = 0;
    const d = valid();
    Object.defineProperty(d.easing, 1, {
      get() {
        reads++;
        return 0;
      },
    });
    expect(() => snapshotResidentMotion(d as any)).toThrow('Invalid declaration');
    expect(reads).toBe(0);
  });
  it('rejects declaration accessors without invoking them', () => {
    let reads = 0;
    const d = valid();
    Object.defineProperty(d, 'easing', {
      get() {
        reads++;
        return [0, 0, 1, 1];
      },
    });
    expect(() => snapshotResidentMotion(d as any)).toThrow('Invalid declaration');
    expect(reads).toBe(0);
  });
  it('freezes detached dense snapshots', () => {
    const d = valid();
    const s = snapshotResidentMotion(d as any);
    d.easing[1] = 3;
    expect(s.easing).toEqual([0, 0, 1, 1]);
    expect(Object.isFrozen(s.easing)).toBe(true);
  });
});
