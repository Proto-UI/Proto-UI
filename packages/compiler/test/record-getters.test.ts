// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { checkTargetOperations, TARGET_PROFILES } from '../src/targets';
import { traceCallableDemand } from '../src/callable-effects';
import { emitRustDataSource } from '../src/rust-data-source';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

const source = (body: string, module = '') =>
  `import{definePrototype,delay}from'@proto.ui/core';${module}
  export default definePrototype({name:'record-getter-contract',setup(def){${body}}});`;

function checked(body: string, module = ''): PrototypeIR {
  const parsed = parsePrototype(source(body, module));
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const cold = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!cold.ok) throw new Error(JSON.stringify(cold.diagnostics));
  return cold.value;
}

function record(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'record' }> {
  const declaration = ir.setup.body.find((statement) => statement.kind === 'const');
  if (declaration?.kind !== 'const' || declaration.value.kind !== 'record')
    throw new Error('Expected an ordinary getter record.');
  return declaration.value;
}

describe('ordinary readonly record accessors', () => {
  it('retains the actual throw-only getter body and its scalar result domain through cold IR', () => {
    const ir = checked(
      `const record={get value():number{throw 37;}};
      def.expose.method('read',()=>record.value);return()=>null;`
    );
    const value = record(ir);
    expect(value.type).toEqual({
      kind: 'object',
      fields: [{ name: 'value', type: 'number', readonly: true, accessor: 'get' }],
    });
    expect(value.entries[0]).toMatchObject({
      accessor: 'get',
      value: { kind: 'function', function: { parameters: [], body: [{ kind: 'throw' }] } },
    });
  });

  it('does not demand a getter body merely because its object exists', () => {
    const ir = checked(
      `const record={get value(){def.expose.value('executed',1);return 9;}};
      const has=Object.hasOwn(record,'value');def.expose.value('has',has);return()=>null;`
    );
    const operations: string[] = [];
    const functions = new Set<unknown>();
    traceCallableDemand(ir, {
      expression(value) {
        if (value.kind === 'operation') operations.push(value.operation);
      },
      function(value) {
        functions.add(value);
      },
      hook() {},
      opaque() {
        throw new Error('Opaque getter flow');
      },
    });
    const getter = record(ir).entries[0].value;
    if (getter.kind !== 'function') throw new Error('Missing getter body.');
    expect(functions.has(getter.function)).toBe(false);
    expect(operations.filter((operation) => operation === 'expose.value')).toHaveLength(1);
  });

  it.each([
    'record.value',
    'record["value"]',
    '{...record}',
    '({...record,value:0})',
    'Object.assign({}, {get value(){def.expose.value("executed",1);return 9;}})',
  ])('attributes getter execution to the actual callback read: %s', (read) => {
    expect(
      parsePrototype(
        source(
          `const record={get value(){def.expose.value('executed',1);return 9;}};
      def.expose.method('read',()=>{const result=${read};return 1;});return()=>null;`
        )
      )
    ).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1007', message: expect.stringMatching(/phase|setup|callback/i) }],
    });
  });

  it('retains getter effects when a spread result is ordinary data and unused', () => {
    const ir = checked(`let reads=0;const record={get value(){reads++;return reads;}};
      def.expose.method('read',()=>{const unused={...record};return reads;});return()=>null;`);
    const visited: ExpressionIR[] = [];
    traceCallableDemand(ir, {
      expression(value) {
        visited.push(value);
      },
      function() {},
      hook() {},
      opaque() {},
    });
    expect(visited.some((value) => value.kind === 'lexical-update')).toBe(true);
  });

  it('creates writable data when a getter is copied, while aliases remain readonly', () => {
    checked(`const record={get value(){return 2;}};const copy={...record};copy.value=7;
      def.expose.value('copy',copy);return()=>null;`);
    for (const action of [
      'record.value=7;',
      'const alias=record;alias.value=7;',
      'const hidden:Readonly<{value:number}>=record;',
      'const hidden=record as Readonly<{value:number}>;',
      'const hidden=record as unknown as Readonly<{value:number}>;',
      'def.expose.value("record",record);',
    ])
      expect(
        parsePrototype(source(`const record={get value(){return 2;}};${action}return()=>null;`))
      ).toMatchObject({ ok: false });
  });

  it('distinguishes a data override from a possibly absent optional override', () => {
    checked(`const record={get value(){def.expose.value('unread',1);return 1;},...{value:7},call:()=>1};
      def.expose.method('read',()=>record.value);return()=>null;`);
    expect(
      parsePrototype(
        source(`const maybe:{value?:number}={};
      const record={get value(){def.expose.value('executed',1);return 1;},...maybe,call:()=>1};
      def.expose.method('read',()=>record.value);return()=>null;`)
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1007' }] });
  });

  it.each([
    'get value(){return this.other;},other:1',
    'set value(next:number){}',
    'get ["value"](){return 1;}',
    'get value(input:number){return input;}',
    'get value():number{}',
    'get value():number{return;}',
  ])('retains unsupported or unlawful accessor negative controls: %s', (fields) => {
    expect(parsePrototype(source(`const record={${fields}};return()=>null;`))).toMatchObject({
      ok: false,
    });
  });

  it.each([
    'if(record.value!==null){const invalid:number=record.value;}',
    'const had=record.value!==null;if(had){const invalid:number=record.value;}',
  ])('never reuses a getter result as proof for a later invocation: %s', (read) => {
    expect(
      parsePrototype(
        source(
          `let next:number|null=1;const record={get value(){const prior=next;next=null;return prior;}};${read}return()=>null;`
        )
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
    checked(`let next:number|null=1;const record={get value(){const prior=next;next=null;return prior;}};
      const snapshot=record.value;if(snapshot!==null){const valid:number=snapshot;}return()=>null;`);
  });

  it.each(['record.value', '{...record}', 'read()'])(
    'invalidates caller facts after getter effects: %s',
    (read) => {
      expect(
        parsePrototype(
          source(`let value:number|null=1;const record={get value(){value=null;return 1;}};
      const read=()=>record.value;if(value!==null){const used=${read};const invalid:number=value;}return()=>null;`)
        )
      ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
    }
  );

  it('admits inert shared module getter creation without replacing its thrown result', () => {
    checked(
      `def.expose.method('read',()=>shared.value);return()=>null;`,
      'const shared={get value():number{throw 29;}};'
    );
  });

  it.each([
    'function owned(){return delay(1,()=>{});}const shared={get value(){owned();return 1;}};',
    'function owned(task=delay(1,()=>{})){return 1;}function indirect(){return owned();}const shared={get value(){return indirect();}};',
  ])('rejects changing module getter identity to capture an owner: %s', (module) => {
    expect(
      parsePrototype(source(`def.expose.method('read',()=>shared.value);return()=>null;`, module))
    ).toMatchObject({
      ok: false,
      diagnostics: [{ message: expect.stringContaining('module getter object') }],
    });
  });

  it('independently rejects a cold module getter with a newly owner-dependent helper', () => {
    const ir = checked(
      `def.expose.method('read',()=>shared.value);return()=>null;`,
      'function helper(){return 1;}const shared={get value(){return helper();}};'
    );
    const donor = checked(
      `def.expose.method('read',helper);return()=>null;`,
      'function helper(){delay(1,()=>{});return 1;}'
    );
    const target = ir.moduleBindings?.find((binding) => binding.value.kind === 'function');
    const operation = donor.moduleBindings?.find((binding) => binding.value.kind === 'function');
    if (target?.value.kind !== 'function' || operation?.value.kind !== 'function')
      throw new Error('Expected module helper controls.');
    target.value.function.body = operation.value.function.body;
    expect(validateIR(ir)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002', message: expect.stringContaining('module getter object') }],
    });
  });

  it('keeps getter code outside the finite pure Rust data selection domain', () => {
    const ir = checked(
      `def.expose.method('read',helper);return()=>null;`,
      'function helper(){const record={get value(){return 1;}};return record.value;}'
    );
    expect(emitRustDataSource(ir, { methods: ['read'] })).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI_RUST_DATA_PURITY' }],
    });
  });

  it.each(['gpui-source-v1', 'qt-source-v1', 'flutter-source-v1'] as const)(
    'diagnoses a reached getter instead of emitting incompatible native storage on %s',
    (profile) => {
      const ir = checked(
        `const record={get value(){return 2;}};def.expose.method('read',()=>record.value);return()=>null;`
      );
      const result = checkTargetOperations(ir, TARGET_PROFILES[profile]);
      expect(result).toMatchObject({
        ok: false,
        diagnostics: expect.arrayContaining([
          {
            code: profile === 'gpui-source-v1' ? 'PUI4003' : 'PUI4001',
            category: 'unsupported-input',
            message: expect.stringContaining(
              profile === 'gpui-source-v1' ? 'Record getters' : 'no working emitter'
            ),
            span: expect.any(Object),
          },
        ]),
      });
    }
  );

  it.each(['erase', 'setter', 'parameters', 'writable', 'missing-throw'])(
    'rejects cold IR that forges accessor proof: %s',
    (mutation) => {
      const ir = checked(
        `const record={get value():number{throw 37;}};def.expose.method('read',()=>record.value);return()=>null;`
      );
      const value = record(ir) as any;
      const entry = value.entries[0];
      if (mutation === 'erase') delete entry.accessor;
      if (mutation === 'setter') entry.accessor = 'set';
      if (mutation === 'parameters') {
        entry.value.function.parameters.push({ name: 'input', type: 'number' });
        entry.value.type.parameters.push({ name: 'input', type: 'number' });
      }
      if (mutation === 'writable') value.type.fields[0].readonly = false;
      if (mutation === 'missing-throw') entry.value.function.body = [];
      expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    }
  );
});
