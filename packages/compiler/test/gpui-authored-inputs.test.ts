// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { dataBoundaryType, intrinsicResult } from '../src/value-types';
import { memberDataType } from '../src/expression-types';
import type { ValueType } from '../src/ir';

const source = (name: string) =>
  readFileSync(new URL(`./fixtures/gpui-a11y-value/${name}.proto.ts`, import.meta.url), 'utf8');
const prototype = (body: string) => `import {definePrototype} from '@proto.ui/core';
  import {asAccessible} from '@proto.ui/hooks';
  export default definePrototype({name:'authored-input-boundary',setup(def){${body};return r=>r.slot();}});`;
const condition = (when: string) =>
  prototype(`const a=asAccessible();const value=def.state.bool('value',false);
  const enabled=def.state.bool('enabled',true);a.state('pressed',value,{when:${when}});`);

describe('native authored input atoms', () => {
  it.each(['activation', 'host-activation', 'text', 'press-modifiers'])(
    'compiles the unchanged authored %s control',
    (name) => {
      const result = compilePrototype(source(name), { profile: 'gpui-source-v1' });
      expect(result.ok, JSON.stringify(result)).toBe(true);
    }
  );
  it.each(['true', 'false', 'null', '1', '()=>true', "def.state.string('wrong','true')"])(
    'rejects a non-Boolean State condition %s',
    (when) => {
      expect(compilePrototype(condition(when), { profile: 'gpui-source-v1' })).toMatchObject({
        ok: false,
      });
    }
  );
  it.each(['react-dom-source-v1', 'vue-source-v1', 'vue2-source-v1', 'web-component-source-v1'])(
    'does not silently discard conditional state in %s',
    (profile) => {
      expect(compilePrototype(condition('enabled'), { profile })).toMatchObject({
        ok: false,
        diagnostics: [{ code: 'PUI4003' }],
      });
    }
  );
  it('uses real Runtime condition support in the runtime-backed profile', () => {
    expect(compilePrototype(condition('enabled'), { profile: 'react-runtime-v1' }).ok).toBe(true);
  });
  it('keeps readonly lexical type while proving its outward JSON snapshot', () => {
    const parsed = parsePrototype(source('host-activation'));
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const event = parsed.value.exposes.find((expose) => expose.name === 'changed');
    expect(event).toMatchObject({ kind: 'event', payload: { kind: 'record' } });
    expect(validateIR(parsed.value).ok).toBe(true);
    expect(
      dataBoundaryType({
        kind: 'object',
        fields: [{ name: 'value', type: 'string', readonly: true }],
      })
    ).toEqual({ kind: 'record', fields: [{ name: 'value', type: 'string' }] });
  });
  it.each<ValueType>([
    'unknown',
    'run',
    'state:boolean',
    { kind: 'callable', parameters: [], returnType: 'boolean' },
    { kind: 'object', fields: [], index: 'string' },
    { kind: 'object', fields: [{ name: 'hidden', type: 'state:boolean', readonly: true }] },
    { kind: 'object', fields: [{ name: 'value', type: 'void', readonly: true }] },
  ])('does not erase authority or non-JSON fields at an outward boundary: %j', (type) => {
    expect(dataBoundaryType(type)).toBeUndefined();
  });
  it('admits UTF-16 length without admitting arbitrary string members', () => {
    expect(memberDataType('string', 'length')).toBe('number');
    expect(memberDataType({ kind: 'literal', value: 'a😀' }, 'length')).toBe('number');
    expect(
      memberDataType({ kind: 'union', members: ['string', 'null'] }, 'length', { optional: true })
    ).toEqual({ kind: 'union', members: ['number', 'void'] });
    for (const type of ['number', 'boolean'] as const)
      expect(() => memberDataType(type, 'length')).toThrow();
    expect(() => memberDataType('string', 'slice')).toThrow();
  });
  it.each(['math.floor', 'math.round'] as const)(
    'requires one checked numeric operand for %s',
    (name) => {
      expect(intrinsicResult(name, ['number'])).toBe('number');
      for (const args of [[], ['string'], ['null'], ['number', 'number']] as ValueType[][])
        expect(() => intrinsicResult(name, args)).toThrow();
    }
  );
  it.each(['Number({value:1})', 'Math.floor("1")', 'Math.round(null)'])(
    'rejects an unadmitted conversion %s',
    (value) => {
      expect(
        compilePrototype(prototype(`def.expose.method('read',()=>${value})`), {
          profile: 'gpui-source-v1',
        })
      ).toMatchObject({ ok: false });
    }
  );
  it('keeps builtin shadowing authored', () => {
    const result = compilePrototype(
      prototype(`const Math={floor:(value:number)=>value+9};
      const Number=(value:string)=>value;def.expose.method('read',()=>Math.floor(2));
      def.expose.method('text',()=>Number('12'));`),
      { profile: 'gpui-source-v1' }
    );
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.value.output.code).not.toContain('math_round(');
  });
  it.each([true, false])('isolates a terminal cancellation branch (terminal=%s)', (terminal) => {
    const code = `import {definePrototype,type RunHandle} from '@proto.ui/core';
      export default definePrototype({name:'branch-owner',setup(def){
        def.props.define({enabled:{type:'boolean',default:true}});
        let owner:RunHandle<{enabled?:boolean}>|null=null;
        def.lifecycle.onCreated(run=>{owner=run;});
        const cancel=()=>{owner=null;};
        def.expose.method('read',(stop:boolean)=>{
          if(!owner)return false;
          if(stop){cancel();${terminal ? 'return false;' : ''}}
          return owner.props.get().enabled ?? false;
        });return r=>r.slot();}});`;
    const result = compilePrototype(code, { profile: 'gpui-source-v1' });
    expect(result.ok, JSON.stringify(result)).toBe(terminal);
  });
});
