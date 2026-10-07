// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { acceptsValue, dataTypeEqual, type DataType } from '../src/data-types';
import { inferBinaryType, inferUnaryType, memberDataType } from '../src/expression-types';

const literal = (value: string | number | boolean | null): DataType => ({ kind: 'literal', value });
const either = (...members: DataType[]): DataType => ({ kind: 'union', members });
const record: DataType = {
  kind: 'record',
  fields: [
    { name: 'title', type: 'string' },
    { name: 'count', type: 'number', optional: true },
    { name: 'nested', type: { kind: 'record', fields: [{ name: 'enabled', type: 'boolean' }] } },
  ],
};

function expectType(actual: DataType, expected: DataType): void {
  expect(dataTypeEqual(actual, expected)).toBe(true);
}

describe('target-independent expression types', () => {
  it('distinguishes string concatenation from arithmetic primitive coercion', () => {
    expect(inferBinaryType('+', 'number', 'string')).toBe('string');
    expect(inferBinaryType('+', 'string', 'null')).toBe('string');
    expect(inferBinaryType('+', 'boolean', 'number')).toBe('number');
    expect(inferBinaryType('-', 'string', 'number')).toBe('number');
    expect(inferBinaryType('*', 'boolean', 'void')).toBe('number');
    expect(inferUnaryType('+', 'string')).toBe('number');
    expect(inferUnaryType('-', 'null')).toBe('number');
    expectType(inferBinaryType('+', either('string', 'number'), 'number'), either('string', 'number'));
    expect(inferBinaryType('+', either('string', 'number'), 'string')).toBe('string');
  });

  it('rejects implicit object coercion including an invalid union alternative', () => {
    expect(() => inferUnaryType('-', record)).toThrow(TypeError);
    expect(() => inferBinaryType('+', record, 'string')).toThrow(TypeError);
    expect(() => inferBinaryType('*', { kind: 'array', element: 'number' }, 'number')).toThrow(TypeError);
    expect(() => inferBinaryType('<', either('number', record), 'number')).toThrow(TypeError);
    expect(() => inferBinaryType('**', 'number', 'number')).toThrow(TypeError);
    expect(() => inferUnaryType('~', 'number')).toThrow(TypeError);
  });

  it('preserves strict identity equality and scalar comparison results', () => {
    expect(inferBinaryType('===', record, 'null')).toBe('boolean');
    expect(inferBinaryType('!==', { kind: 'array', element: 'number' }, record)).toBe('boolean');
    expect(inferBinaryType('<', 'string', 'string')).toBe('boolean');
    expect(inferBinaryType('>=', 'null', 'number')).toBe('boolean');
  });

  it('retains the operands actually returned by logical short circuiting', () => {
    expectType(inferBinaryType('&&', 'boolean', 'string'), either(literal(false), 'string'));
    expectType(inferBinaryType('||', 'boolean', 'string'), either(literal(true), 'string'));
    expectType(inferBinaryType('&&', 'string', 'number'), either(literal(''), 'number'));
    expectType(inferBinaryType('&&', literal(false), record), literal(false));
    expectType(inferBinaryType('||', literal(true), record), literal(true));
    expectType(inferBinaryType('&&', record, 'number'), 'number');
    expectType(inferBinaryType('||', record, 'number'), record);
    // NaN is falsy as well as zero, so a general number cannot narrow to the literal 0.
    const numericFallback = inferBinaryType('||', 'number', 'string');
    expect(acceptsValue(numericFallback, 12)).toBe(true);
    expect(acceptsValue(numericFallback, 'fallback')).toBe(true);
    expect(acceptsValue(numericFallback, false)).toBe(false);
  });

  it('removes only nullish alternatives for coalescing, not other falsy values', () => {
    expectType(inferBinaryType('??', either('null', 'void', 'number'), 'string'), either('number', 'string'));
    expectType(inferBinaryType('??', literal(false), 'string'), literal(false));
    expectType(inferBinaryType('??', literal(''), 'number'), literal(''));
    expect(inferBinaryType('??', 'void', 'string')).toBe('string');
    expect(inferBinaryType('??', literal(null), 'number')).toBe('number');
  });

  it('infers negation from JS truthiness without evaluating source', () => {
    expectType(inferUnaryType('!', literal('')), literal(true));
    expectType(inferUnaryType('!', 'void'), literal(true));
    expectType(inferUnaryType('!', record), literal(false));
    expect(inferUnaryType('!', 'number')).toBe('boolean');
    expect(inferUnaryType('!', either('null', record))).toBe('boolean');
  });

  it('resolves nested records and preserves optional-field absence', () => {
    expect(memberDataType(record, 'title')).toBe('string');
    expect(memberDataType(memberDataType(record, 'nested'), 'enabled')).toBe('boolean');
    const optionalCount = memberDataType(record, 'count');
    expect(acceptsValue(optionalCount, undefined)).toBe(true);
    expect(acceptsValue(optionalCount, 3)).toBe(true);
    expect(acceptsValue(optionalCount, null)).toBe(false);
    expect(inferBinaryType('??', optionalCount, 'number')).toBe('number');
  });

  it('requires optional access for nullable receivers and suppresses only nullish failures', () => {
    const nullable = either(record, 'null', 'void');
    expect(() => memberDataType(nullable, 'title')).toThrow(TypeError);
    expectType(memberDataType(nullable, 'title', { optional: true }), either('string', 'void'));
    expect(memberDataType(record, 'title', { optional: true })).toBe('string');
    expect(memberDataType(literal(null), 'missing', { optional: true })).toBe('void');
    expect(() => memberDataType(nullable, 'missing', { optional: true })).toThrow(TypeError);
    expect(() => memberDataType('string', 'missing', { optional: true })).toThrow(TypeError);
    const missingOnOneBranch = either(record, { kind: 'record', fields: [] });
    expect(() => memberDataType(missingOnOneBranch, 'title', { optional: true })).toThrow(TypeError);
    expect(() => memberDataType(record, 'toString')).toThrow(TypeError);
  });

  it('preserves record-union field alternatives and array out-of-bounds absence', () => {
    const variant = { kind: 'record', fields: [{ name: 'title', type: 'number' }] } as const;
    expectType(memberDataType(either(record, variant), 'title'), either('string', 'number'));
    const rows: DataType = { kind: 'array', element: record };
    const row = memberDataType(rows, 0);
    expectType(row, either(record, 'void'));
    expectType(memberDataType(row, 'title', { optional: true }), either('string', 'void'));
    expect(memberDataType(rows, 'length')).toBe('number');
    expectType(memberDataType(rows, '12'), row);
    expect(() => memberDataType(rows, '01')).toThrow(TypeError);
    expect(() => memberDataType(rows, -1)).toThrow(TypeError);
    expect(() => memberDataType(rows, 0.5)).toThrow(TypeError);
    expect(() => memberDataType(rows, 'map')).toThrow(TypeError);
  });

  it('preserves the bottom element type of empty arrays without hiding missing reads', () => {
    const never: DataType = { kind: 'union', members: [] };
    expect(memberDataType({ kind: 'array', element: never }, 0)).toBe('void');
    expectType(inferUnaryType('-', never), never);
    expectType(inferBinaryType('===', never, 'number'), never);
    expectType(inferBinaryType('&&', literal(false), never), literal(false));
    expectType(inferBinaryType('||', literal(true), never), literal(true));
    expect(inferBinaryType('??', 'number', never)).toBe('number');
  });
});
