// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  acceptsValue,
  dataTypeEqual,
  formatDataType,
  inferDataType,
  isAssignable,
  parseDataType,
  type DataType,
} from '../src/data-types';

const payload: DataType = {
  kind: 'record',
  fields: [
    { name: 'id', type: 'number' },
    { name: 'label', type: 'string', optional: true },
    { name: 'items', type: { kind: 'array', element: { kind: 'union', members: ['string', 'null'] } } },
  ],
};

describe('portable data types', () => {
  it('checks nested payloads without conflating absent, null, and undefined', () => {
    const type = parseDataType(payload);
    expect(acceptsValue(type, { id: 1, items: ['item', null] })).toBe(true);
    expect(acceptsValue(type, { id: 1, label: 'label', items: [], extra: true })).toBe(true);
    for (const value of [
      { items: [] },
      { id: 1, label: null, items: [] },
      { id: 1, label: undefined, items: [] },
      { id: 1, items: [undefined] },
      { id: '1', items: [] },
      { id: 1, items: [false] },
    ]) expect(acceptsValue(type, value)).toBe(false);
    expect(acceptsValue('void', undefined)).toBe(true);
    expect(acceptsValue('void', null)).toBe(false);
    expect(acceptsValue('null', undefined)).toBe(false);
    expect(acceptsValue('null', null)).toBe(true);
    expect(isAssignable('void', 'null')).toBe(false);
    expect(isAssignable('null', 'void')).toBe(false);
  });

  it('enforces literal constraints and union coverage rather than accepting one possible branch', () => {
    const yes: DataType = { kind: 'literal', value: true };
    const no: DataType = { kind: 'literal', value: false };
    const booleanUnion: DataType = { kind: 'union', members: [yes, no] };
    expect(acceptsValue(yes, true)).toBe(true);
    expect(acceptsValue(yes, false)).toBe(false);
    expect(isAssignable(yes, 'boolean')).toBe(true);
    expect(isAssignable('boolean', yes)).toBe(false);
    expect(isAssignable('boolean', booleanUnion)).toBe(true);
    expect(isAssignable(booleanUnion, 'boolean')).toBe(true);
    expect(isAssignable({ kind: 'union', members: ['number', 'string'] }, 'number')).toBe(false);
    expect(isAssignable('number', { kind: 'union', members: ['number', 'null'] })).toBe(true);
    expect(acceptsValue({ kind: 'literal', value: 'open' }, 'closed')).toBe(false);
  });

  it('uses structural width assignment while retaining required and optional field obligations', () => {
    const required: DataType = { kind: 'record', fields: [{ name: 'id', type: 'number' }] };
    const optional: DataType = { kind: 'record', fields: [{ name: 'id', type: 'number', optional: true }] };
    const empty: DataType = { kind: 'record', fields: [] };
    const nullable: DataType = {
      kind: 'record', fields: [{ name: 'id', type: { kind: 'union', members: ['number', 'null'] } }],
    };
    expect(isAssignable(required, optional)).toBe(true);
    expect(isAssignable(optional, required)).toBe(false);
    expect(isAssignable(empty, required)).toBe(false);
    expect(isAssignable(empty, optional)).toBe(true);
    expect(isAssignable(required, nullable)).toBe(true);
    expect(isAssignable(nullable, required)).toBe(false);
    expect(isAssignable(inferDataType({ id: 2, extra: false }), required)).toBe(true);
    expect(isAssignable({ kind: 'array', element: optional }, { kind: 'array', element: required })).toBe(false);
  });

  it('infers heterogeneous JSON arrays and a bottom element for empty arrays', () => {
    const inferred = inferDataType({ id: 1, items: ['a', null] });
    expect(isAssignable(inferred, payload)).toBe(true);
    expect(acceptsValue(inferred, { id: 2, items: [null, 'b'] })).toBe(true);
    expect(acceptsValue(inferred, { id: 2, items: [false] })).toBe(false);
    const empty = inferDataType([]);
    expect(isAssignable(empty, { kind: 'array', element: 'number' })).toBe(true);
    expect(acceptsValue(empty, [])).toBe(true);
    expect(acceptsValue(empty, [1])).toBe(false);
    expect(acceptsValue(parseDataType({ kind: 'union', members: [] }), null)).toBe(false);
    expect(inferDataType(undefined)).toBe('void');
  });

  it('rejects host objects, lossy JSON values, and hidden payloads even in extra record fields', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic.self = cyclic;
    const symbolKey = { [Symbol('hidden')]: true };
    const hidden = Object.defineProperty({}, 'hidden', { value: true });
    const extendedArray = Object.assign([1], { extra: true });
    class HostRecord { id = 1; }
    for (const value of [
      NaN, Infinity, -Infinity, 1n, Symbol('value'), () => 1,
      new Date(0), new Map(), new HostRecord(), cyclic, symbolKey, hidden,
      [, 1], extendedArray, { item: undefined }, [undefined],
      { extra: new Date(0) },
    ]) {
      expect(() => inferDataType(value)).toThrow(TypeError);
      expect(acceptsValue({ kind: 'record', fields: [] }, value)).toBe(false);
    }
    const shared = { id: 1 };
    expect(acceptsValue(inferDataType([shared, shared]), [shared, shared])).toBe(true);
    const plain = Object.assign(Object.create(null), { id: 1, items: [] });
    expect(acceptsValue(payload, plain)).toBe(true);
    const plainArray = Object.setPrototypeOf([1, 2], null);
    expect(acceptsValue({ kind: 'array', element: 'number' }, plainArray)).toBe(true);
  });

  it('never invokes schema or payload accessors', () => {
    let calls = 0;
    const getter = () => { calls += 1; return 'number'; };
    const schema = Object.defineProperty({ kind: 'array' }, 'element', { enumerable: true, get: getter });
    const value = Object.defineProperty({}, 'id', { enumerable: true, get: getter });
    const array = Object.defineProperty([1], '0', { enumerable: true, get: getter });
    expect(() => parseDataType(schema)).toThrow(TypeError);
    expect(() => inferDataType(value)).toThrow(TypeError);
    expect(acceptsValue({ kind: 'record', fields: [] }, value)).toBe(false);
    expect(acceptsValue({ kind: 'array', element: 'number' }, array)).toBe(false);
    expect(calls).toBe(0);
  });

  it('rejects malformed schemas rather than inheriting, coercing, or ignoring declarations', () => {
    const cycle: { kind: 'array'; element?: unknown } = { kind: 'array' };
    cycle.element = cycle;
    const inherited = Object.create({ kind: 'array', element: 'number' });
    for (const schema of [
      'any', 'undefined', 'record', null, undefined, [],
      { kind: 'array' }, { kind: 'array', element: 'number', extra: true },
      { kind: 'union' }, { kind: 'union', members: 'number' },
      { kind: 'union', members: ['number', 'unknown'] },
      { kind: 'literal', value: Infinity }, { kind: 'literal', value: undefined },
      { kind: 'literal', value: {} },
      { kind: 'record', fields: {} },
      { kind: 'record', fields: [{ name: 1, type: 'number' }] },
      { kind: 'record', fields: [{ name: 'id', type: 'number', optional: undefined }] },
      { kind: 'record', fields: [{ name: 'id', type: 'number', extra: true }] },
      { kind: 'record', fields: [{ name: 'id', type: 'number' }, { name: 'id', type: 'string' }] },
      { kind: 'record', fields: [, { name: 'id', type: 'number' }] },
      { kind: 'array', element: 'number', [Symbol('hidden')]: true },
      inherited, cycle,
    ]) expect(() => parseDataType(schema)).toThrow(TypeError);
  });

  it('treats record and union ordering as immaterial but not field optionality', () => {
    const a = parseDataType(payload);
    const b = parseDataType({ ...payload, fields: [...payload.fields].reverse() });
    expect(dataTypeEqual(a, b)).toBe(true);
    expect(dataTypeEqual({ kind: 'union', members: ['string', 'number', 'string'] },
      { kind: 'union', members: ['number', 'string'] })).toBe(true);
    expect(dataTypeEqual({ kind: 'union', members: ['number'] }, 'number')).toBe(true);
    expect(dataTypeEqual({ kind: 'record', fields: [{ name: 'id', type: 'number' }] },
      { kind: 'record', fields: [{ name: 'id', type: 'number', optional: true }] })).toBe(false);
  });

  it('formats deterministic declarations with hygienic property and literal quoting', () => {
    const type: DataType = {
      kind: 'record', fields: [
        { name: 'z"; injected: never; //', type: { kind: 'literal', value: 'line\n"\\\u2028' } },
        { name: '__proto__', type: { kind: 'array', element: { kind: 'union', members: ['string', 'null'] } }, optional: true },
        { name: '', type: 'void' },
      ],
    };
    expect(formatDataType(type)).toBe(
      '{ "": void; "__proto__"?: Array<null | string>; "z\\\"; injected: never; //": "line\\n\\\"\\\\\\u2028"; }'
    );
    expect(formatDataType(type)).toBe(formatDataType({ ...type, fields: [...type.fields].reverse() }));
    expect(formatDataType({ kind: 'union', members: [] })).toBe('never');
  });
});
