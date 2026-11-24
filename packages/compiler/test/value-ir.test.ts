import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { functionValueType, joinValueTypes } from '../src/value-types';
import { deriveHookCapture } from '../src/capture-analysis';
import type { ExpressionIR, FunctionIR, PrototypeIR, StatementIR, ValueType } from '../src/ir';

function fixture(): PrototypeIR {
  const parsed = parsePrototype(
    `import {definePrototype} from '@proto.ui/core'; export default definePrototype({name:'values',setup(def){}});`
  );
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  return structuredClone(parsed.value);
}
const location = fixture().setup.span;
const literal = (value: number | string | boolean | null): ExpressionIR => ({
  kind: 'literal',
  value,
  type: value === null ? 'null' : (typeof value as ValueType),
  span: location,
});
const reference = (name: string, type: ValueType, bindingId?: string): ExpressionIR => ({
  kind: 'reference',
  name,
  type,
  ...(bindingId ? { bindingId } : {}),
  span: location,
});
const constant = (name: string, value: ExpressionIR, bindingId?: string): StatementIR => ({
  kind: 'const',
  name,
  value,
  ...(bindingId ? { bindingId } : {}),
  span: location,
});
const effect = (expression: ExpressionIR): StatementIR => ({
  kind: 'effect',
  expression,
  span: location,
});
const helper = (body: StatementIR[], returnType: ValueType = 'void'): FunctionIR => ({
  parameters: [],
  body,
  returnType,
  phase: 'callback',
  context: 'helper',
  span: location,
});

describe('ordinary value IR validation', () => {
  it('validates generic cells, record methods, calls, and conditional values without source snippets', () => {
    const ir = fixture();
    const objectType: ValueType = { kind: 'record', fields: [{ name: 'ready', type: 'boolean' }] };
    const cellType: ValueType = { kind: 'cell', value: joinValueTypes([objectType, 'null']) };
    const fn = helper([{ kind: 'return', value: literal(3), span: location }], 'number');
    const recordType: ValueType = {
      kind: 'object',
      fields: [{ name: 'read', type: functionValueType(fn) }],
    };
    ir.setup.body.push(
      constant(
        'state',
        { kind: 'lexical-cell', value: literal(null), type: cellType, span: location },
        'input#state'
      ),
      effect({
        kind: 'lexical-write',
        cell: reference('state', cellType, 'input#state'),
        value: {
          kind: 'record',
          entries: [{ key: 'ready', value: literal(true) }],
          type: objectType,
          span: location,
        },
        type: objectType,
        span: location,
      }),
      constant('methods', {
        kind: 'record',
        entries: [
          {
            key: 'read',
            value: { kind: 'function', function: fn, type: functionValueType(fn), span: location },
          },
        ],
        type: recordType,
        span: location,
      }),
      effect({
        kind: 'call',
        callee: {
          kind: 'member',
          object: reference('methods', recordType),
          property: 'read',
          optional: false,
          type: functionValueType(fn),
          span: location,
        },
        arguments: [],
        optional: false,
        type: 'number',
        span: location,
      }),
      effect({
        kind: 'conditional',
        condition: literal(true),
        then: literal(1),
        otherwise: literal(2),
        type: 'number',
        span: location,
      })
    );
    const checked = validateIR(ir);
    expect(checked, checked.ok ? undefined : JSON.stringify(checked.diagnostics)).toMatchObject({
      ok: true,
    });
    expect(validateIR(JSON.parse(JSON.stringify(ir)))).toMatchObject({ ok: true });
  });

  it('checks callable defaults in parameter order and captures by declaration identity', () => {
    const ir = fixture();
    const fn = helper(
      [{ kind: 'return', value: reference('input', 'number'), span: location }],
      'number'
    );
    fn.parameters = [
      {
        name: 'input',
        type: 'number',
        optional: true,
        default: reference('fallback', 'number', 'input#fallback'),
      },
    ];
    fn.captures = [{ name: 'fallback', bindingId: 'input#fallback', storage: 'value' }];
    ir.setup.body.push(
      constant('fallback', literal(7), 'input#fallback'),
      constant('read', {
        kind: 'function',
        function: fn,
        type: functionValueType(fn),
        span: location,
      })
    );
    expect(validateIR(ir)).toMatchObject({ ok: true });
    fn.captures[0].bindingId = 'other#fallback';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('rejects callable signature, storage, and member-write provenance forgery', () => {
    const ir = fixture();
    const fn = helper([{ kind: 'return', value: literal(3), span: location }], 'number');
    ir.setup.body.push(
      constant('read', {
        kind: 'function',
        function: fn,
        type: { ...functionValueType(fn), returnType: 'run' },
        span: location,
      })
    );
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    ir.setup.body = [
      constant('state', {
        kind: 'lexical-cell',
        value: literal(1),
        type: { kind: 'cell', value: 'run' },
        span: location,
      }),
    ];
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    ir.setup.body = [
      effect({
        kind: 'member-write',
        object: reference('def', 'def'),
        property: 'props',
        value: literal(1),
        type: 'number',
        span: location,
      }),
    ];
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('checks projection function bodies before trusting projected hook result types', () => {
    const ir = fixture();
    const projection = helper(
      [{ kind: 'return', value: reference('missing', 'run'), span: location }],
      'run'
    );
    projection.phase = 'setup';
    projection.parameters = [{ name: 'result', type: 'authored-result' }];
    ir.hooks.push({
      id: 'hook',
      name: 'hook',
      kind: 'as-hook',
      mode: 'once',
      setup: { ...ir.setup, body: [] },
      projectHandle: projection,
      span: location,
    });
    ir.setup.body.push(
      effect({ kind: 'authored-hook', hookId: 'hook', type: 'run', span: location })
    );
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('checks direct capture schema, borrowed getter types, and nested child ownership', () => {
    const ir = fixture();
    const setup = {
      ...ir.setup,
      body: [
        constant('ready', {
          kind: 'operation',
          operation: 'state.bool',
          receiver: reference('def', 'def'),
          arguments: [literal('ready'), literal(false)],
          type: 'state:boolean',
          span: location,
        }),
      ],
    };
    const capture = deriveHookCapture(setup, [], new Map());
    const resultType = joinValueTypes(['borrowed:boolean', 'void']);
    const project = helper(
      [
        {
          kind: 'return',
          value: {
            kind: 'operation',
            operation: 'capture.getState',
            receiver: reference('result', { kind: 'capture', hookId: 'hook' }),
            arguments: [literal('ready')],
            type: resultType,
            span: location,
          },
          span: location,
        },
      ],
      resultType
    );
    project.phase = 'setup';
    project.parameters = [{ name: 'result', type: { kind: 'capture', hookId: 'hook' } }];
    ir.hooks.push({
      id: 'hook',
      name: 'hook',
      kind: 'as-hook',
      mode: 'once',
      setup,
      capture,
      projectHandle: project,
      span: location,
    });
    expect(validateIR(ir)).toMatchObject({ ok: true });
    capture.states[0].name = 'forged';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('permits erased narrowing only within proven alternatives', () => {
    const ir = fixture();
    const type = joinValueTypes(['number', 'null']);
    const fn = helper(
      [
        {
          kind: 'return',
          value: {
            kind: 'narrow',
            value: reference('value', type),
            type: 'number',
            span: location,
          },
          span: location,
        },
      ],
      'number'
    );
    fn.parameters = [{ name: 'value', type }];
    ir.setup.body.push(
      constant('read', {
        kind: 'function',
        function: fn,
        type: functionValueType(fn),
        span: location,
      })
    );
    expect(validateIR(ir)).toMatchObject({ ok: true });
    (fn.body[0] as Extract<StatementIR, { kind: 'return' }>).value!.type = 'run';
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
