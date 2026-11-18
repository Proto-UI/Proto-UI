// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { functionValueType } from '../src/value-types';
import type { ExpressionIR, PrototypeIR } from '../src/ir';

function source(callback: string, registration = false) {
  const call = `[1, 2].every(${callback});`;
  return `import {definePrototype} from '@proto.ui/core';
    export default definePrototype({name:'array-every-callback',setup(def){
      def.props.define({enabled:{type:'boolean',default:false}});
      ${registration ? `def.lifecycle.onMounted(()=>{${call}});` : call}
    }});`;
}

function admitted(input: string): PrototypeIR {
  const parsed = parsePrototype(input);
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const portable = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!portable.ok) throw new Error(JSON.stringify(portable.diagnostics));
  return portable.value;
}

function every(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'intrinsic' }> {
  let found: Extract<ExpressionIR, { kind: 'intrinsic' }> | undefined;
  const visit = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    if (
      'kind' in value &&
      value.kind === 'intrinsic' &&
      'name' in value &&
      value.name === 'array.every'
    )
      found = value as typeof found;
    Object.values(value).forEach(visit);
  };
  visit(ir);
  if (!found) throw new Error('Expected the authored every call');
  return found;
}

describe('Array.every callback invocation contract', () => {
  it.each([
    ['no formals', '()=>true'],
    ['element only', '(value:number)=>value>0'],
    ['required index', '(value:number,index:number)=>value>index'],
    ['required array', '(value:number,index:number,items:number[])=>items[index]===value'],
    ['contextual three formals', '(value,index,items)=>items[index]===value'],
    [
      'optional extra formal',
      '(value:number,index:number,items:number[],extra?:number)=>extra===undefined',
    ],
  ])('admits source and portable IR with %s', (_name, callback) => {
    admitted(source(callback));
  });

  it.each([
    ['index', '(value:number,index?:string)=>true'],
    ['array', '(value:number,index?:number,items?:string[])=>true'],
    ['required fourth formal', '(value:number,index:number,items:number[],extra:number)=>true'],
  ])('rejects an incompatible %s contract at source intake', (_name, callback) => {
    expect(parsePrototype(source(callback))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006' }],
    });
  });

  it.each([
    [
      'index',
      '(value:number,index?:number)=>{if(index)def.props.setDefaults({enabled:true});return true;}',
    ],
    [
      'array',
      '(value:number,index?:number,items?:number[])=>{if(items)def.props.setDefaults({enabled:true});return true;}',
    ],
  ])('checks effects reached through the supplied optional %s', (_name, callback) => {
    expect(parsePrototype(source(callback, true))).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it('does not execute the index default when the intrinsic supplies an index', () => {
    admitted(`import{definePrototype}from'@proto.ui/core';
      export default definePrototype({name:'every-default',setup(def){
        def.props.define({enabled:{type:'boolean',default:false}});
        const fallback=()=>{def.props.setDefaults({enabled:true});return 0;};
        def.lifecycle.onMounted(()=>{[1,2].every((value:number,index:number=fallback())=>value>index);});
      }});`);
  });

  it('keeps default effects reachable for a checked data element that can be undefined', () => {
    expect(
      parsePrototype(`import{definePrototype}from'@proto.ui/core';
        export default definePrototype({name:'every-optional-data-default',setup(def){
          def.props.define({enabled:{type:'boolean',default:false}});
          const fallback=()=>{def.props.setDefaults({enabled:true});return 0;};
          def.lifecycle.onMounted(()=>{
            [1,undefined].every((value:number|undefined=fallback())=>true);
          });
        }});`)
    ).toMatchObject({
      ok: false,
      diagnostics: [
        { code: 'PUI1007', message: 'props.setDefaults is not permitted in callback.' },
      ],
    });
  });

  it.each([1, 2])('rechecks supplied formal %i after a portable IR type mutation', (index) => {
    const ir = admitted(source('(value:number,index?:number,items?:number[])=>true'));
    const intrinsic = every(ir);
    const callback = intrinsic.arguments[1];
    if (callback.kind !== 'function') throw new Error('Expected the authored callback');
    callback.function.parameters[index].type =
      index === 1 ? 'string' : { kind: 'array', element: 'string' };
    callback.type = functionValueType(callback.function);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });
});
