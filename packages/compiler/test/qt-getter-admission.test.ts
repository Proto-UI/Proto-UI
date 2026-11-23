// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import type { PrototypeIR } from '../src/ir';
import { validateIR } from '../src/ir-validation';
import { parsePrototype } from '../src/parser';
import { emitQtSource } from '../src/qt-source';

const fileName = 'qt-getter-admission.proto.ts';
function source(body: string, declarations = '') {
  return `import {definePrototype,defineAsHook} from '@proto.ui/core';
    ${declarations}
    export default definePrototype({name:'qt-getter-admission',setup(def){
      ${body}return()=>null;
    }});`;
}

function parse(text: string): PrototypeIR {
  const result = parsePrototype(text, { fileName });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function cold(ir: PrototypeIR): PrototypeIR {
  const result = validateIR(JSON.parse(JSON.stringify(ir)));
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.value;
}

function expectUnsupported(ir: PrototypeIR) {
  expect(emitQtSource(ir)).toMatchObject({
    ok: false,
    diagnostics: expect.arrayContaining([
      {
        code: 'PUI4003',
        category: 'unsupported-input',
        message: 'Record getters are not implemented by qt-source.',
        span: expect.objectContaining({ file: fileName }),
      },
    ]),
  });
}

const getter = 'const record={get value():number{return 42;}};';
const read = "def.expose.method('read',()=>record.value);";
const cases = [
  ['setup record', source(getter + read)],
  [
    'inline record',
    source("def.expose.method('read',()=>({get value():number{return 42;}}).value);"),
  ],
  ['spread record', source('const record={...{other:1},get value():number{return 42;}};' + read)],
  ['shared module', source(read, getter)],
] as const;

describe('Qt direct getter admission follows actual emitted source', () => {
  it.each(cases)('rejects the %s accessor through the public emitter', (_, text) => {
    expectUnsupported(parse(text));
  });

  it.each(cases)('rejects the %s accessor after independent cold validation', (_, text) => {
    expectUnsupported(cold(parse(text)));
  });

  it.each(['reached', 'retained-cold-ir'] as const)(
    'checks the %s Hook setup actually printed by Qt',
    (mode) => {
      const ir = cold(
        parse(
          source(
            'useRead();',
            `
      const useRead=defineAsHook({name:'getter-hook',setup(def){${getter}${read}}});
    `
          )
        )
      );
      if (mode === 'retained-cold-ir') {
        const before = ir.setup.body.length;
        ir.setup.body = ir.setup.body.filter(
          (statement) =>
            !(statement.kind === 'effect' && statement.expression.kind === 'authored-hook')
        );
        expect(ir.setup.body).toHaveLength(before - 1);
        expect(ir.hooks.length).toBeGreaterThan(0);
        expect(validateIR(ir).ok).toBe(true);
      }
      expectUnsupported(ir);
    }
  );

  it('permits a dormant accessor whose entire record is pruned before emission', () => {
    const ir = parse(
      source(`
      const unused={get neverPrinted():number{return 42;}};
      def.expose.value('answer',7);
    `)
    );
    const emitted = emitQtSource(cold(ir));
    expect(emitted.ok, JSON.stringify(emitted.ok ? {} : emitted.diagnostics)).toBe(true);
    if (emitted.ok) {
      expect(emitted.value.code).not.toContain('neverPrinted');
      for (const file of emitted.value.supportingFiles ?? [])
        expect(file.contents).not.toContain('neverPrinted');
    }
  });

  it.each([
    "const record={value:42};def.expose.method('read',()=>record.value);",
    "const record={read:()=>42};def.expose.method('read',()=>record.read());",
  ])('keeps ordinary records and callable-valued fields: %s', (body) => {
    const emitted = emitQtSource(cold(parse(source(body))));
    expect(emitted.ok, JSON.stringify(emitted.ok ? {} : emitted.diagnostics)).toBe(true);
  });

  it.each([
    'react-dom-source-v1',
    'vue-source-v1',
    'vue2-source-v1',
    'web-component-source-v1',
  ] as const)('retains supported native JavaScript getters in %s', (profile) => {
    const emitted = compilePrototype(source(getter + read), { profile, fileName });
    expect(emitted.ok, JSON.stringify(emitted.ok ? {} : emitted.diagnostics)).toBe(true);
  });
});
