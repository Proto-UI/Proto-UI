import { describe, expect, it } from 'vitest';
import { interactionValueAlternatives } from '../src/interaction-value-shape';
import { NativeLexicalScope } from '../src/template-shape';
import type { ExpressionIR, FunctionIR, StatementIR } from '../src/ir';

const span = {
  file: 'private-shape.proto.ts',
  start: 0,
  end: 1,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 2,
};
const literal = (value: boolean | string): ExpressionIR => ({
  kind: 'literal',
  value,
  type: typeof value === 'boolean' ? 'boolean' : 'string',
  span,
});
const ref = (name: string): ExpressionIR => ({
  kind: 'reference',
  name,
  type: 'module-config',
  span,
});
const record = (entries: Record<string, ExpressionIR>): ExpressionIR => ({
  kind: 'record',
  entries: Object.entries(entries).map(([key, value]) => ({ key, value })),
  type: 'module-config',
  span,
});
const returned = (value: ExpressionIR): StatementIR => ({ kind: 'return', value, span });
const helper = (body: StatementIR[], parameters: FunctionIR['parameters'] = []): ExpressionIR => ({
  kind: 'function',
  type: 'function',
  span,
  function: {
    body,
    parameters,
    returnType: 'module-config',
    phase: 'setup',
    context: 'helper',
    span,
  },
});
const call = (name: string, args: ExpressionIR[] = []): ExpressionIR => ({
  kind: 'helper-call',
  name,
  arguments: args,
  type: 'module-config',
  span,
});
const scope = (entries: [string, ExpressionIR][]) =>
  entries.reduce((s, [name, value]) => s.bind(name, value), NativeLexicalScope.empty());
const values = (value: ExpressionIR, env: NativeLexicalScope) =>
  interactionValueAlternatives(value, env)?.map((x) => x.value);

describe('compiler-private immutable interaction value alternatives', () => {
  it('resolves finite repeated identity calls using actual argument frames', () => {
    const config = record({ disabled: literal(false) });
    const env = scope([
      ['id', helper([returned(ref('value'))], [{ name: 'value', type: 'module-config' }])],
    ]);
    expect(values(call('id', [call('id', [config])]), env)).toEqual([config]);
  });
  it('retains a returned closure capture rather than a same-name caller binding', () => {
    const captured = record({ disabled: literal(false) });
    const wrong = record({ extra: literal(true) });
    const closure = helper([returned(ref('config'))]);
    const factory = helper([returned(closure)], [{ name: 'config', type: 'module-config' }]);
    const env = scope([
      ['factory', factory],
      ['get', call('factory', [captured])],
      ['config', wrong],
    ]);
    expect(values(call('get'), env)).toEqual([captured]);
  });
  it('keeps both possible return records instead of admitting only the first', () => {
    const a = record({ disabled: literal(false) });
    const b = record({ extra: literal(true) });
    const flag: ExpressionIR = { kind: 'reference', name: 'flag', type: 'boolean', span };
    const incoming: ExpressionIR = { kind: 'reference', name: 'incoming', type: 'boolean', span };
    const fn = helper(
      [{ kind: 'if', condition: flag, then: [returned(a)], otherwise: [], span }, returned(b)],
      [{ name: 'flag', type: 'boolean' }]
    );
    expect(values(call('choose', [incoming]), scope([['choose', fn]]))).toEqual([a, b]);
  });
  it('does not borrow an omitted formal from an outer same-name record', () => {
    const env = scope([
      ['config', record({ disabled: literal(false) })],
      ['id', helper([returned(ref('config'))], [{ name: 'config', type: 'module-config' }])],
    ]);
    expect(interactionValueAlternatives(call('id'), env)).toBeNull();
  });
  it('resolves a member through a helper result while preserving its field frame', () => {
    const config = record({ disabled: ref('disabled') });
    const env = scope([
      ['disabled', literal(false)],
      ['get', helper([returned(record({ config }))])],
    ]);
    const member: ExpressionIR = {
      kind: 'member',
      object: call('get'),
      property: 'config',
      optional: false,
      type: 'module-config',
      span,
    };
    const alternatives = interactionValueAlternatives(member, env);
    expect(alternatives).toHaveLength(1);
    const chosen = alternatives![0]!;
    expect(chosen.value).toBe(config);
    expect(values(ref('disabled'), chosen.scope)).toEqual([literal(false)]);
  });
  it('does not mutate source records, functions or argument arrays', () => {
    const config = record({ disabled: literal(false) });
    const id = helper([returned(ref('value'))], [{ name: 'value', type: 'module-config' }]);
    const expression = call('id', [config]);
    const before = JSON.stringify({ config, id, expression });
    expect(values(expression, scope([['id', id]]))).toEqual([config]);
    expect(JSON.stringify({ config, id, expression })).toBe(before);
  });
  it('does not manufacture a record from an opaque module-config annotation', () => {
    const fake: ExpressionIR = { ...literal(true), type: 'module-config' };
    const env = scope([
      ['value', fake],
      ['get', helper([returned(ref('value'))])],
    ]);
    expect(values(call('get'), env)).toEqual([fake]);
    expect(values(call('get'), env)?.some((value) => value?.kind === 'record')).toBe(false);
  });
  it('retains an undefined fallthrough next to an if-only record return', () => {
    const config = record({ disabled: literal(false) });
    const flag: ExpressionIR = { kind: 'reference', name: 'flag', type: 'boolean', span };
    const fn = helper([
      { kind: 'if', condition: flag, then: [returned(config)], otherwise: [], span },
    ]);
    expect(values(call('get'), scope([['get', fn]]))).toEqual([config, undefined]);
  });
  it('does not select the known record when another return has unknown member provenance', () => {
    const unknown: ExpressionIR = {
      kind: 'member',
      object: ref('opaque'),
      property: 'config',
      optional: false,
      type: 'module-config',
      span,
    };
    const flag: ExpressionIR = { kind: 'reference', name: 'flag', type: 'boolean', span };
    const fn = helper([
      {
        kind: 'if',
        condition: flag,
        then: [returned(record({ disabled: literal(false) }))],
        otherwise: [],
        span,
      },
      returned(unknown),
    ]);
    expect(interactionValueAlternatives(call('get'), scope([['get', fn]]))).toBeNull();
  });
  it('terminates unresolved recursive helper provenance without inventing a record', () => {
    const fn = helper([returned(call('loop'))]);
    expect(interactionValueAlternatives(call('loop'), scope([['loop', fn]]))).toBeNull();
  });
  it('terminates a cyclic expression graph without traversing it indefinitely', () => {
    const cyclic: ExpressionIR = {
      kind: 'member',
      object: record({}),
      property: 'config',
      optional: false,
      type: 'module-config',
      span,
    };
    cyclic.object = cyclic;
    expect(interactionValueAlternatives(cyclic, NativeLexicalScope.empty())).toBeNull();
  });
});
