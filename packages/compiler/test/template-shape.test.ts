import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { emitWebComponentSource } from '../src/web-component-source';
import type { ExpressionIR, FunctionIR, StatementIR, ValueType } from '../src/ir';
import { nativeShape, NativeLexicalScope } from '../src/template-shape';

const span = {
  file: 'shape.proto.ts',
  start: 0,
  end: 1,
  line: 1,
  column: 1,
  endLine: 1,
  endColumn: 2,
};
const ref = (name: string, type: ValueType = 'template'): ExpressionIR => ({
  kind: 'reference',
  name,
  type,
  span,
});
const literal = (value: string | number | boolean | null): ExpressionIR => ({
  kind: 'literal',
  value,
  type: { kind: 'literal', value },
  span,
});
const returned = (value?: ExpressionIR): StatementIR => ({ kind: 'return', value, span });
const helper = (body: StatementIR[], parameters: FunctionIR['parameters'] = []): ExpressionIR => ({
  kind: 'function',
  type: 'function',
  span,
  function: { body, parameters, returnType: 'template', phase: 'render', context: 'helper', span },
});
const call = (name: string, args: ExpressionIR[] = []): ExpressionIR => ({
  kind: 'helper-call',
  name,
  arguments: args,
  type: 'template',
  span,
});

const scope = (entries: [string, ExpressionIR][] = []) =>
  entries.reduce((env, [name, value]) => env.bind(name, value), NativeLexicalScope.empty());

describe('compiler-private template shape extraction', () => {
  it('distinguishes constructor provenance from an unknown legacy template annotation', () => {
    const node: ExpressionIR = {
      kind: 'operation',
      operation: 'render.slot',
      arguments: [],
      type: 'template',
      span,
    };
    expect(nativeShape(node, scope())).toEqual({ kind: 'node' });
    expect(nativeShape(ref('unknown'), scope())).toEqual({ kind: 'legacy-template' });
    expect(nativeShape({ ...literal('text'), type: 'template' }, scope())).toEqual({
      kind: 'text',
    });
  });

  it('retains finite nested identity helper calls without treating function reuse as recursion', () => {
    const bindings = scope([
      ['id', helper([returned(ref('value'))], [{ name: 'value', type: 'template' }])],
    ]);
    expect(nativeShape(call('id', [call('id', [literal('text')])]), bindings)).toEqual({
      kind: 'union',
      items: [{ kind: 'union', items: [{ kind: 'text' }] }],
    });
  });
  it.each([
    ['hello', 'text'],
    [3, 'text'],
    [null, 'null'],
    [true, 'invalid'],
  ] as const)('retains literal %s shape', (value, kind) => {
    expect(nativeShape(literal(value), scope())).toEqual({ kind });
  });

  it('keeps explicit void invalid and bottom a zero-member union', () => {
    expect(nativeShape(ref('undefined', 'void'), scope())).toEqual({ kind: 'undefined' });
    expect(nativeShape(ref('bottom', { kind: 'union', members: [] }), scope())).toEqual({
      kind: 'union',
      items: [],
    });
  });

  it('preserves nested array element shapes rather than widening to node', () => {
    const nested: ExpressionIR = {
      kind: 'array',
      type: 'array',
      span,
      elements: [
        literal('a'),
        { kind: 'array', type: 'array', span, elements: [literal(null), ref('native')] },
      ],
    };
    expect(nativeShape(nested, scope())).toEqual({
      kind: 'array',
      items: [
        { kind: 'text' },
        { kind: 'array', items: [{ kind: 'null' }, { kind: 'legacy-template' }] },
      ],
    });
  });

  it('follows aliases and record members, not the umbrella result type', () => {
    const record: ExpressionIR = {
      kind: 'record',
      type: 'record',
      span,
      entries: [{ key: 'body', value: literal('text') }],
    };
    const bindings = scope([
      ['original', record],
      ['alias', ref('original', 'record')],
    ]);
    const member: ExpressionIR = {
      kind: 'member',
      type: 'template',
      span,
      object: ref('alias', 'record'),
      property: 'body',
      optional: false,
    };
    expect(nativeShape(member, bindings)).toEqual({ kind: 'text' });
  });

  it('substitutes actual helper arguments through a helper alias', () => {
    const bindings = scope([
      ['identity', helper([returned(ref('child'))], [{ name: 'child', type: 'template' }])],
      ['alias', ref('identity', 'function')],
    ]);
    expect(nativeShape(call('alias', [literal(null)]), bindings)).toEqual({
      kind: 'union',
      items: [{ kind: 'null' }],
    });
    expect(nativeShape(call('alias', [literal('text')]), bindings)).toEqual({
      kind: 'union',
      items: [{ kind: 'text' }],
    });
  });

  it('retains all helper returns instead of trusting a template umbrella', () => {
    const branches: StatementIR = {
      kind: 'if',
      span,
      condition: literal(true),
      then: [returned(ref('native'))],
      otherwise: [returned(literal('text'))],
    };
    expect(nativeShape(call('choose'), scope([['choose', helper([branches])]]))).toEqual({
      kind: 'union',
      items: [{ kind: 'legacy-template' }, { kind: 'text' }],
    });
  });

  it('does not hide fallthrough as an empty valid child', () => {
    const branches: StatementIR = {
      kind: 'if',
      span,
      condition: literal(true),
      then: [returned(ref('native'))],
      otherwise: [],
    };
    expect(nativeShape(call('maybe'), scope([['maybe', helper([branches])]]))).toEqual({
      kind: 'union',
      items: [{ kind: 'legacy-template' }, { kind: 'undefined' }],
    });
  });

  it('uses helper declaration environment rather than caller parameter spelling', () => {
    const node: ExpressionIR = {
      kind: 'operation',
      operation: 'render.slot',
      arguments: [],
      type: 'template',
      span,
    };
    const bindings = scope([
      ['child', node],
      ['f', helper([returned(ref('child'))])],
      ['g', helper([returned(call('f'))], [{ name: 'child', type: 'string' }])],
    ]);
    expect(nativeShape(call('g', [literal('shadow')]), bindings)).toEqual({
      kind: 'union',
      items: [{ kind: 'union', items: [{ kind: 'node' }] }],
    });
    const renamed = scope([
      ['child', node],
      ['f', helper([returned(ref('child'))])],
      ['g', helper([returned(call('f'))], [{ name: 'other', type: 'string' }])],
    ]);
    expect(nativeShape(call('g', [literal('shadow')]), bindings)).toEqual(
      nativeShape(call('g', [literal('shadow')]), renamed)
    );
  });

  it('resolves actual parameter expressions in caller scope without leaking them to captures', () => {
    const node: ExpressionIR = {
      kind: 'operation',
      operation: 'render.slot',
      arguments: [],
      type: 'template',
      span,
    };
    const bindings = scope([
      ['child', node],
      ['id', helper([returned(ref('value', 'string'))], [{ name: 'value', type: 'string' }])],
      ['f', helper([returned(ref('child'))])],
      [
        'g',
        helper(
          [returned(call('id', [ref('child', 'string')]))],
          [{ name: 'child', type: 'string' }]
        ),
      ],
    ]);
    expect(nativeShape(call('g', [literal('caller')]), bindings)).toEqual({
      kind: 'union',
      items: [{ kind: 'union', items: [{ kind: 'text' }] }],
    });
    expect(nativeShape(call('f'), bindings)).toEqual({ kind: 'union', items: [{ kind: 'node' }] });
  });

  it('retains caller record provenance across a helper formal and member access', () => {
    const recordType: ValueType = { kind: 'record', fields: [{ name: 'body', type: 'string' }] };
    const record: ExpressionIR = {
      kind: 'record',
      type: recordType,
      span,
      entries: [{ key: 'body', value: ref('captured', 'string') }],
    };
    const member: ExpressionIR = {
      kind: 'member',
      object: ref('box', recordType),
      property: 'body',
      optional: false,
      type: 'string',
      span,
    };
    const bindings = scope([
      ['captured', literal('caller-text')],
      ['data', record],
      ['pick', helper([returned(member)], [{ name: 'box', type: recordType }])],
      [
        'g',
        helper(
          [returned(call('pick', [ref('data', recordType)]))],
          [{ name: 'captured', type: 'boolean' }]
        ),
      ],
    ]);
    expect(nativeShape(call('g', [literal(true)]), bindings)).toEqual({
      kind: 'union',
      items: [{ kind: 'union', items: [{ kind: 'text' }] }],
    });
  });

  it.each(['&&', '||', '??'] as const)(
    'retains both %s alternatives without evaluation',
    (operator) => {
      const value: ExpressionIR = {
        kind: 'binary',
        span,
        type: 'template',
        operator,
        left: literal(null),
        right: ref('native'),
      };
      expect(nativeShape(value, scope())).toEqual({
        kind: 'union',
        items: [{ kind: 'null' }, { kind: 'legacy-template' }],
      });
    }
  );

  it('reports unresolved cycles and missing helper definitions honestly', () => {
    const cyclic: ExpressionIR = { kind: 'array', type: 'array', span, elements: [] };
    cyclic.elements.push(cyclic);
    expect(nativeShape(cyclic, scope())).toBeNull();
    expect(nativeShape(call('missing'), scope())).toBeNull();
  });

  it('renaming lexical identifiers and source paths does not alter shape facts', () => {
    const original = helper([returned(literal('text'))]);
    const renamed = { ...original, span: { ...span, file: 'another-component.proto.ts' } };
    expect(nativeShape(call('a'), scope([['a', original]]))).toEqual(
      nativeShape(call('z'), scope([['z', renamed]]))
    );
  });
});

// These use the real frontend, not hand-made IR that widens admission.
describe('definition-environment frontend controls', () => {
  it.each(['child', 'other'])(
    'keeps captured native output when caller parameter is %s',
    (parameter) => {
      const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'lexical-shape-control',setup(){return r=>{
const child=r.el('span','captured');const f=()=>child;const g=(${parameter}:string)=>f();return g('shadow');};}});`;
      const parsed = parsePrototype(source, { fileName: 'lexical-control.proto.ts' });
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const emitted = emitWebComponentSource(parsed.value);
      if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
      expect(emitted.value.code).toMatch(/appendChild\(\([^\n]+ as \(\)=>Node\)\(\)\)/);
    }
  );
});

// Recursion remains the existing frontend diagnostic; no new shape admission.
describe('existing recursive-helper admission boundary', () => {
  it('retains PUI1008 for explicitly typed self-recursion', () => {
    const parsed = parsePrototype(
      `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'recursive-control',setup(){const loop=():string=>loop();return r=>r.el('span',loop());}});`,
      { fileName: 'recursive-control.proto.ts' }
    );
    expect(parsed.ok).toBe(false);
    if (!parsed.ok)
      expect(parsed.diagnostics.some((diagnostic) => diagnostic.code === 'PUI1008')).toBe(true);
  });
});
