// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';

const source = (body: string) => `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'throw-only-current-source',setup(def){
  function fail(flag:boolean):number {${body}}
  const alias=fail;
  def.expose.method('fail',alias);
  return()=>null;
}});`;

describe('current public throw-only function return domain', () => {
  it.each([
    'throw 42;',
    "throw {code:'sentinel',value:0};",
    'if(flag){throw false;}else{throw null;}',
    "try{throw new Error('original');}finally{const retained=3;}",
    "try{return 3;}finally{throw new Error('replacement');}",
  ])('accepts a declared number when every normal result is unreachable: %s', (body) => {
    const parsed = parsePrototype(source(body));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(parsed.value.exposes).toEqual([
      expect.objectContaining({ name: 'fail', kind: 'method', returnType: 'number' }),
    ]);
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    expect(JSON.stringify(parsed.value.setup)).toContain('"kind":"throw"');
  });

  it.each([
    '',
    'return;',
    'if(flag){throw 42;}',
    "if(flag){throw 42;}else{return 'wrong';}",
    "try{throw 42;}finally{return 'replacement';}",
    'try{throw 42;}catch(error){}',
  ])('retains declared-return negative controls: %s', (body) => {
    expect(parsePrototype(source(body))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006', message: expect.stringContaining('declared type') }],
    });
  });

  it('cold validation rejects removing the throwing terminal from an admitted function', () => {
    const parsed = parsePrototype(source('throw 42;'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const forged = JSON.parse(JSON.stringify(parsed.value));
    const declaration = forged.setup.body.find(
      (statement: { name?: string }) => statement.name === 'fail'
    );
    expect(declaration.value.function.body).toEqual([expect.objectContaining({ kind: 'throw' })]);
    declaration.value.function.body = [];
    expect(validateIR(forged)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
