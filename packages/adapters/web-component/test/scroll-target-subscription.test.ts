import { describe, expect, it, vi } from 'vitest';
import { subscribeScrollTarget } from '../src/runtime/scroll-target';

describe('Scroll target composite subscription', () => {
  it.each([undefined, null, false, 0, ''])(
    'retains initial thrown %s and releases first acquired listener',
    (failure) => {
      const cleanup = vi.fn(() => {
        throw new Error('secondary');
      });
      let didThrow = false;
      let caught: unknown;
      try {
        subscribeScrollTarget(
          () => cleanup,
          () => {
            throw failure;
          },
          () => {}
        );
      } catch (error) {
        didThrow = true;
        caught = error;
      }
      expect(didThrow).toBe(true);
      expect(caught).toBe(failure);
      expect(cleanup).toHaveBeenCalledOnce();
    }
  );
  it('attempts both cleanup leases once and preserves the first thrown value', () => {
    const first = vi.fn(() => {
        throw null;
      }),
      second = vi.fn(() => {
        throw new Error('secondary');
      });
    const off = subscribeScrollTarget(
      () => first,
      () => second,
      () => {}
    );
    let caught: unknown = 'unset';
    try {
      off();
    } catch (error) {
      caught = error;
    }
    expect(caught).toBe(null);
    expect(() => off()).not.toThrow();
    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });
});
