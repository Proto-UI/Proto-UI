import { describe, expect, it } from 'vitest';
import { snapshotStaticHitInset } from '../src/hit-participation';

describe('static hit inset declaration', () => {
  it('snapshots finite physical edges in logical pixels or root text units', () => {
    const input = { top: { value: 0.5, unit: 'rem' as const } };
    const result = snapshotStaticHitInset(input);
    input.top.value = 99;
    expect(result.top).toEqual({ value: 0.5, unit: 'rem' });
    expect(result.left).toEqual({ value: 0, unit: 'px' });
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.top)).toBe(true);
  });
  it.each([-1, Infinity, NaN, '1', undefined])('rejects invalid distance %s', (value) => {
    expect(() => snapshotStaticHitInset({ left: { value, unit: 'px' } } as any)).toThrow(
      /staticHitInset/
    );
  });
  it.each(['em', '%', 'device-px', 'vh', ''])('rejects unsupported unit %s', (unit) => {
    expect(() => snapshotStaticHitInset({ left: { value: 1, unit } } as any)).toThrow(
      /staticHitInset/
    );
  });
  it('rejects getters and unknown fields without invoking them', () => {
    let calls = 0;
    expect(() =>
      snapshotStaticHitInset({
        get top() {
          calls++;
          return { value: 1, unit: 'px' as const };
        },
      })
    ).toThrow();
    expect(calls).toBe(0);
    expect(() => snapshotStaticHitInset({ inline: { value: 1, unit: 'px' } } as any)).toThrow();
  });
});
