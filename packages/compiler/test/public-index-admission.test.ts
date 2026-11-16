import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { emitReact } from '../src/react';
import { emitReactSource } from '../src/react-source';
import { emitVueSource } from '../src/vue-source';
import { emitVue2Source } from '../src/vue2-source';
import { emitWebComponentSource } from '../src/web-component-source';
import { emitGpuiSource } from '../src/gpui-source';
import { isPublicValueType, type ValueType } from '../src/ir';
import { valueAssignable } from '../src/value-types';

const source = `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'indexed-public',setup(def){
def.expose.value('box',{action:()=>7});return r=>r.el('div',[]);}});`;
const callable: ValueType = { kind: 'callable', parameters: [], returnType: 'number' };
describe('portable indexed object boundary', () => {
  for (const index of [
    callable,
    'run',
    'number',
    { kind: 'object', fields: [{ name: 'action', type: callable }] },
  ] satisfies ValueType[])
    it(`rejects unimplemented typed index projection: ${JSON.stringify(index)}`, () => {
      const parsed = parsePrototype(source);
      if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
      const ir = structuredClone(parsed.value),
        statement = ir.setup.body[0];
      if (statement.kind !== 'effect' || statement.expression.kind !== 'operation')
        throw new Error('Missing public value');
      const type: ValueType = { kind: 'object', fields: [], index };
      const original = statement.expression.arguments[1];
      statement.expression.arguments[1] = {
        kind: 'narrow',
        value: original,
        type,
        span: original.span,
      };
      const exposure = ir.exposes[0];
      if (exposure.kind !== 'value') throw new Error('Missing value exposure');
      exposure.type = type;
      const rejected = {
        ok: false,
        diagnostics: expect.arrayContaining([
          expect.objectContaining({
            code: 'PUI2002',
            message: 'Indexed object values only admit the unknown internal-store view.',
          }),
        ]),
      };
      expect(validateIR(ir)).toMatchObject(rejected);
      for (const emit of [
        emitReact,
        emitReactSource,
        emitVueSource,
        emitVue2Source,
        emitWebComponentSource,
        emitGpuiSource,
      ])
        expect(emit(ir), emit.name).toMatchObject(rejected);
      expect(isPublicValueType(type)).toBe(false);
    });

  it('checks index constraints before treating a structural view as callable authority', () => {
    const numeric: ValueType = { kind: 'record', fields: [{ name: 'action', type: 'number' }] };
    const indexed: ValueType = { kind: 'object', fields: [], index: callable };
    expect(valueAssignable(numeric, indexed)).toBe(false);
    expect(valueAssignable({ kind: 'object', fields: [], index: 'unknown' }, indexed)).toBe(false);
    expect(
      valueAssignable({ kind: 'object', fields: [{ name: 'action', type: callable }] }, indexed)
    ).toBe(true);
    // A type relation is not admission of a dynamically indexed public surface.
    expect(isPublicValueType(indexed)).toBe(false);
  });

  it('retains opaque internal stores and explicit finite public fields', () => {
    const parsed = parsePrototype(`import {defineHook,definePrototype} from '@proto.ui/core';
import type {JsonObject} from '@proto.ui/core';
const install=defineHook({name:'store-view',setup(def,options:void,api){
const store:JsonObject=api.store;const read=(value:JsonObject)=>value['answer'];read({answer:4});
def.expose.value('box',{action:()=>7});}});
export default definePrototype({name:'store-owner',setup(){install();}});`);
    expect(parsed.ok, JSON.stringify(parsed.ok ? {} : parsed.diagnostics)).toBe(true);
    if (parsed.ok) expect(validateIR(JSON.parse(JSON.stringify(parsed.value))).ok).toBe(true);
    expect(
      isPublicValueType({ kind: 'object', fields: [{ name: 'action', type: callable }] })
    ).toBe(true);
    expect(isPublicValueType({ kind: 'object', fields: [], index: 'unknown' })).toBe(false);
  });
});
