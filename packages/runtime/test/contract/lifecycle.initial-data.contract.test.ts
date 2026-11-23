// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { cloneOwnerInitialData } from '../../src/instance/initial-data';

describe('C-LIFECYCLE-OWNER-INITIALIZATION-0001 finite initial data', () => {
  it('copies and freezes data, preserving undefined, signed zero and safe property names', () => {
    const source = JSON.parse('{"__proto__":{"pollution":true},"list":[1,{"value":2}]}');
    source.unset = undefined;
    source.zero = -0;
    const copy = cloneOwnerInitialData(source);
    expect(copy).not.toBe(source);
    expect(copy.list[1]).not.toBe(source.list[1]);
    source.list[1].value = 99;
    expect(copy.list[1].value).toBe(2);
    expect(Object.is(copy.zero, -0)).toBe(true);
    expect(Object.hasOwn(copy, 'unset')).toBe(true);
    expect(copy.unset).toBeUndefined();
    expect(copy.__proto__).toEqual({ pollution: true });
    expect(Object.getPrototypeOf(copy)).toBeNull();
    expect(Object.isFrozen(copy.list[1])).toBe(true);
  });

  it('rejects object and array getters before reading their values', () => {
    let reads = 0;
    for (const input of [
      Object.defineProperty({}, 'value', {
        enumerable: true,
        get() {
          reads++;
          return 1;
        },
      }),
      Object.defineProperty([1], '0', {
        enumerable: true,
        get() {
          reads++;
          return 1;
        },
      }),
    ]) {
      expect(() => cloneOwnerInitialData(input)).toThrow(/accessor/);
    }
    expect(reads).toBe(0);
  });

  it.each([
    () => ({ fn() {} }),
    () => ({ handle: Symbol('live') }),
    () => new Date(),
    () => ({ value: Infinity }),
    () => ({ value: NaN }),
    () => ({ value: 1n }),
    () => {
      const value: any = {};
      value.self = value;
      return value;
    },
    () => new Array(3),
    () => Object.assign([1], { extra: 2 }),
    () => {
      const value = [1];
      Object.defineProperty(value, Symbol('hidden'), { value: 2 });
      return value;
    },
    () => Object.defineProperty({}, 'hidden', { value: 1 }),
    () => {
      let value: any = 0;
      for (let i = 0; i < 66; i++) value = [value];
      return value;
    },
    () => Array(10001).fill(0),
    () => 'x'.repeat(1048577),
  ])('rejects non-data identity, malformed arrays or unbounded data', (make) => {
    expect(() => cloneOwnerInitialData(make())).toThrow(TypeError);
  });

  it('admits repeated references as independent data, never transferring identity', () => {
    const shared = { value: 1 };
    const copy = cloneOwnerInitialData({ left: shared, right: shared });
    expect(copy.left).toEqual(copy.right);
    expect(copy.left).not.toBe(copy.right);
    expect(copy.left).not.toBe(shared);
  });
});
