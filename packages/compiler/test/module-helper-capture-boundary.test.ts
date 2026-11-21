// @vitest-environment node
import { expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { FunctionIR, PrototypeIR } from '../src/ir';

function parsed(alias = false): PrototypeIR {
  const result = parsePrototype(`import {definePrototype} from '@proto.ui/core';
    import {normalize} from './normalize';
    export default definePrototype({name:'module-capture',setup(def){
      const offset=3;
      ${alias ? 'const localNormalize=normalize;' : ''}
      def.expose.method('read',(value:number)=>${alias ? 'localNormalize' : 'normalize'}(value)+offset);
    }});`, {
    fileName: 'entry.proto.ts',
    files: { 'normalize.ts': 'export function normalize(value:number):number{return value+1;}' },
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return JSON.parse(JSON.stringify(result.value));
}
function callback(ir: PrototypeIR): FunctionIR {
  const statement = ir.setup.body.find((item) => item.kind === 'effect' &&
    item.expression.kind === 'operation' && item.expression.operation === 'expose.method');
  if (statement?.kind !== 'effect' || statement.expression.kind !== 'operation')
    throw new Error('Missing method registration');
  const value = statement.expression.arguments[1];
  if (value.kind !== 'function') throw new Error('Missing method callback');
  return value.function;
}

it('separates a proven module helper dependency from owner-local capture metadata', () => {
  const ir = parsed();
  expect(callback(ir).captures?.map((capture) => capture.name)).toEqual(['offset']);
  expect(validateIR(ir)).toMatchObject({ ok: true });
});

it('still rejects missing, wrong-identity and wrong-storage local captures', () => {
  for (const mutation of ['missing', 'identity', 'storage'] as const) {
    const ir = parsed();
    const fn = callback(ir);
    if (!fn.captures?.length) throw new Error('Missing local capture');
    if (mutation === 'missing') fn.captures = [];
    else if (mutation === 'identity') fn.captures[0].bindingId = 'forged';
    else fn.captures[0].storage = 'cell';
    expect(validateIR(ir)).toMatchObject({ ok: false });
  }
});

it('keeps a local alias of a module helper inside the owner capture boundary', () => {
  const ir = parsed(true);
  expect(callback(ir).captures?.some((capture) => capture.name === 'localNormalize')).toBe(true);
  expect(validateIR(ir)).toMatchObject({ ok: true });
  callback(ir).captures = callback(ir).captures?.filter((capture) => capture.name !== 'localNormalize');
  expect(validateIR(ir)).toMatchObject({ ok: false });
});

it('rejects treating a module dependency as a forged local capture', () => {
  const ir = parsed();
  const helper = ir.moduleBindings?.find((item) => item.value.kind === 'function');
  if (!helper) throw new Error('Missing module helper');
  helper.bindingId = 'forged-module-id';
  callback(ir).captures!.push({ name: helper.name, bindingId: 'forged-module-id', storage: 'value' });
  expect(validateIR(ir)).toMatchObject({ ok: false });
});

it('retains full defining-scope provenance for a shared function object', () => {
  const result = parsePrototype(`import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'scope-capture',setup(def){
      function make(value:number){return ()=>value;}
      def.expose.method('first',()=>make(1));
      def.expose.method('second',()=>make(2));
    }});`);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const ir: PrototypeIR = JSON.parse(JSON.stringify(result.value));
  expect(validateIR(ir)).toMatchObject({ ok: true });
  const helper = ir.setup.body.find((item) => item.kind === 'const' && item.value.kind === 'function');
  if (helper?.kind !== 'const' || helper.value.kind !== 'function') throw new Error('Missing local factory');
  const returned = helper.value.function.body.find((item) => item.kind === 'return');
  if (returned?.kind !== 'return' || returned.value?.kind !== 'function') throw new Error('Missing closure');
  // Reuse the closure under the prototype setup, outside its value parameter's defining scope.
  ir.setup.body.push({ kind: 'const', name: 'forgedClosure', value: returned.value, span: returned.span });
  expect(validateIR(ir)).toMatchObject({ ok: false });
});
