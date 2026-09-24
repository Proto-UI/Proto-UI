import { describe, expect, it } from 'vitest';

import { WireBoundaryError, assertWireValue } from '../src';

describe('wire boundary', () => {
  it('accepts bounded data', () => {
    const value = {
      protocolVersion: 0,
      ids: ['a', 'b'],
      nested: { flag: true, count: 3, none: null },
    };
    expect(assertWireValue(value)).toBe(value);
    expect(assertWireValue(null)).toBeNull();
    expect(assertWireValue('text')).toBe('text');
  });

  it('rejects functions, symbols, undefined, bigint and non-finite numbers with a path', () => {
    const cases: readonly [unknown, string, RegExp][] = [
      [{ callback: () => undefined }, 'callback', /functions/],
      [{ token: Symbol('token') }, 'token', /symbols/],
      [{ nested: [1, undefined] }, 'nested[1]', /undefined/],
      [{ big: 1n }, 'big', /bigint/],
      [{ size: Number.NaN }, 'size', /non-finite/],
      [{ size: Number.POSITIVE_INFINITY }, 'size', /non-finite/],
    ];
    for (const [value, path, message] of cases) {
      let caught: unknown;
      try {
        assertWireValue(value);
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(WireBoundaryError);
      expect((caught as WireBoundaryError).path).toBe(path);
      expect((caught as WireBoundaryError).message).toMatch(message);
    }
  });

  it('rejects object identity carriers: class instances, symbol keys and cycles', () => {
    class Handle {
      readonly id = 'handle';
    }
    expect(() => assertWireValue({ handle: new Handle() })).toThrow(/object identity/);
    expect(() => assertWireValue({ [Symbol('secret')]: 1 })).toThrow(/symbol keys/);

    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;
    expect(() => assertWireValue(cyclic)).toThrow(/cyclic/);

    const shared = { ok: true };
    expect(() => assertWireValue({ first: shared, second: shared })).not.toThrow();
  });
});

describe('wire boundary: sparse arrays', () => {
  it('rejects a hole with its exact path instead of skipping it', () => {
    const sparse: unknown[] = new Array(2);
    sparse[1] = 'present';
    let caught: unknown;
    try {
      assertWireValue({ registrations: sparse });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(WireBoundaryError);
    expect((caught as WireBoundaryError).path).toBe('registrations[0]');
    expect((caught as WireBoundaryError).message).toMatch(/sparse array holes/);

    // A deleted slot is the same defect reached a different way.
    const deleted = ['a', 'b'];
    delete (deleted as Record<number, unknown>)[0];
    expect(() => assertWireValue(deleted)).toThrow(/sparse array holes/);

    // A dense array with the same values stays valid.
    expect(() => assertWireValue([undefined])).toThrow(/undefined/);
    expect(assertWireValue(['a', 'b'])).toEqual(['a', 'b']);
  });
});
