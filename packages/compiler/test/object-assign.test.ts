// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { emitFlutterSource } from '../src/flutter-source';
import { emitQtSource } from '../src/qt-source';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { ExpressionIR, PrototypeIR, StatementIR } from '../src/ir';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

function program(body: string): string {
  return `import {definePrototype} from '@proto.ui/core';
export default definePrototype({name:'ordinary-own-data-assignment',setup(def){
${body}
return r=>r.el('output','fresh assignment');
}});`;
}

const source = program(`
  let trace='';
  function mark(label:string,value:number,fail:boolean=false){
    trace+=label;
    if(fail) throw false;
    return value;
  }
  function message(){trace+='target;';return 'native-set';}
  def.expose.method('records',()=>{
    trace='';
    const result=Object.assign(
      {keep:mark('target;',1),replace:'before'},
      {replace:mark('first;',2)},
      {tail:mark('second;',3)}
    );
    return {keep:result.keep,replace:result.replace,tail:result.tail,trace};
  });
  def.expose.method('nestedIdentity',()=>{
    const inner={value:1};
    const result=Object.assign({inner},{code:'metadata'});
    inner.value=7;
    return {same:result.inner===inner,value:result.inner.value};
  });
  def.expose.method('errorIdentity',()=>{
    const detail={value:4};
    const original=Object.assign(new Error('failure'),{code:'FIRST',detail},{code:'LAST'});
    try{
      try{throw original;}catch(first){
        const view=first as {code?:string};
        if(view.code!=='LAST') return false;
        throw first;
      }
    }catch(second){
      const view=second as {name?:string;message?:string;code?:string;detail?:unknown};
      return second===original&&view.name==='Error'&&view.message==='failure'&&
        view.code==='LAST'&&view.detail===detail;
    }
    return false;
  });
  def.expose.method('zeroSources',()=>Object.assign({value:4}).value);
  def.expose.method('unusedResult',()=>{
    trace='';
    Object.assign({value:mark('unused-target;',1)},{extra:mark('unused-source;',2)});
    return trace;
  });
  def.expose.method('throwingArgument',()=>{
    trace='';
    try{
      Object.assign({value:mark('before;',1)},{next:mark('throws;',2,true)},
        {after:mark('after;',3)});
    }catch(error){return {same:error===false,trace};}
    return {same:false,trace};
  });
  def.expose.method('nativeSetter',()=>{
    trace='';
    try{
      Object.assign(new Error(message()),{assignProbe:mark('source;',1)},
        {tail:mark('tail;',2)});
    }catch(error){return {same:error===false,trace};}
    return {same:false,trace};
  });
`);

function portable(text: string = source): PrototypeIR {
  const parsed = parsePrototype(text, { fileName: 'ordinary-assignment.proto.ts' });
  if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
  const checked = validateIR(JSON.parse(JSON.stringify(parsed.value)));
  if (!checked.ok) throw new Error(JSON.stringify(checked.diagnostics));
  return checked.value;
}

function assignments(ir: PrototypeIR): Extract<ExpressionIR, { kind: 'intrinsic' }>[] {
  const found: Extract<ExpressionIR, { kind: 'intrinsic' }>[] = [];
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    const node = value as Record<string, unknown>;
    if (node.kind === 'intrinsic' && node.name === 'object.assign')
      found.push(value as Extract<ExpressionIR, { kind: 'intrinsic' }>);
    for (const [key, child] of Object.entries(node))
      if (!['type', 'span', 'sourceFiles'].includes(key)) visit(child);
  }
  visit(ir);
  return found;
}

function forgery(target = "new Error('fresh')"): PrototypeIR {
  return portable(
    program(`
    const original=new Error('original');
    const data={code:'DATA'};
    const patch={code:'PATCH'};
    const callback=()=>1;
    const saved=Object.assign(${target},{code:'NEW'});
    def.expose.method('read',()=>{
      callback();
      return {data:data.code,patch:patch.code,same:saved===saved,original:original===original};
    });
  `)
  );
}

function reference(ir: PrototypeIR, name: string): ExpressionIR {
  const binding = ir.setup.body.find(
    (statement): statement is Extract<StatementIR, { kind: 'const' }> =>
      statement.kind === 'const' && statement.name === name
  );
  if (!binding) throw new Error(`Missing test binding ${name}.`);
  return {
    kind: 'reference',
    name,
    type: binding.value.type,
    span: binding.span,
    ...(binding.bindingId ? { bindingId: binding.bindingId } : {}),
  };
}

function rejectsAssignment(ir: PrototypeIR): void {
  const checked = validateIR(ir);
  expect(checked.ok).toBe(false);
  if (!checked.ok)
    expect(
      checked.diagnostics.some((diagnostic) => diagnostic.message.includes('Object.assign'))
    ).toBe(true);
}

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
});

describe('fresh-target own-data Object.assign', () => {
  it('round-trips finite record and opaque Error results through portable validation', () => {
    const ir = portable();
    expect(assignments(ir).some((value) => value.type === 'exception')).toBe(true);
    expect(
      assignments(ir).some(
        (value) => typeof value.type !== 'string' && value.type.kind === 'record'
      )
    ).toBe(true);
    portable(program(`const value=Object.assign(new Error());`));
  });

  it.each([
    'Object.assign();',
    'Object.assign(null,{value:1});',
    'Object.assign([],{value:1});',
    'const target={value:1};Object.assign(target,{value:2});',
    "const target=new Error('saved');Object.assign(target,{code:'X'});",
    "try{throw false;}catch(error){Object.assign(error,{code:'X'});}",
    'Object.assign(Object.freeze({value:1}),{value:2});',
    'Object.assign(({value:1} as const),{value:2});',
    'Object.assign(({value:1} as {readonly value:number}),{value:2});',
    'const patch={value:1};Object.assign({},patch);',
    'Object.assign({},({value:1} as const));',
    'Object.assign({},null);',
    'Object.assign({},[1]);',
    'Object.assign({},1);',
    'Object.assign({},{...{value:1}});',
    'Object.assign({},{get value(){return 1;}});',
    "const key='value';Object.assign({},{[key]:1});",
    'Object.assign({},{read:()=>1});',
    "const state=def.state.number('value',0);Object.assign({},{state});",
    "const state=def.state.number('value',0);Object.assign({state},{code:'X'});",
    'Object.assign({},{__proto__:{value:1}});',
    'Object.assign({__proto__:{value:1}},{});',
    'Object.assign?.({},{value:1});',
    'Object?.assign({},{value:1});',
  ])('keeps unsupported source inputs explicit: %s', (body) => {
    expect(parsePrototype(program(body)).ok).toBe(false);
  });

  it('does not infer data or capability authority from an enriched exception', () => {
    expect(
      parsePrototype(
        program(`
      const error=Object.assign(new Error('x'),{code:'DATA'});
      const code:string=error.code;
    `)
      ).ok
    ).toBe(false);
    expect(
      parsePrototype(
        program(`
      try{throw Object.assign(new Error('x'),{code:'DATA'});}catch(error){
        const projected=error as {state:{get():number}};
        projected.state.get();
      }
    `)
      ).ok
    ).toBe(false);
  });

  it.each(['original', 'data'])('rejects a coherent aliased %s target in serialized IR', (name) => {
    const ir = forgery(name === 'data' ? "{code:'TARGET'}" : undefined);
    assignments(ir)[0].arguments[0] = reference(ir, name);
    rejectsAssignment(ir);
  });

  it('rejects an aliased source with the same finite data type in serialized IR', () => {
    const ir = forgery();
    assignments(ir)[0].arguments[1] = reference(ir, 'patch');
    rejectsAssignment(ir);
  });

  it('rejects a frozen target even when its field types remain identical', () => {
    const ir = forgery("{code:'TARGET'}"),
      call = assignments(ir)[0];
    const target = call.arguments[0];
    call.arguments[0] = {
      kind: 'intrinsic',
      name: 'object.freeze',
      arguments: [target],
      type: target.type,
      span: target.span,
    };
    rejectsAssignment(ir);
  });

  it('rejects a readonly target view in serialized IR', () => {
    const ir = forgery("{code:'TARGET'}"),
      call = assignments(ir)[0];
    const target = call.arguments[0];
    call.arguments[0] = {
      kind: 'narrow',
      value: target,
      type: { kind: 'object', fields: [{ name: 'code', type: 'string', readonly: true }] },
      span: target.span,
    };
    rejectsAssignment(ir);
  });

  it('rejects callable fields without relying on an Error result-type mismatch', () => {
    const ir = forgery(),
      call = assignments(ir)[0];
    const callback = reference(ir, 'callback');
    call.arguments[1] = {
      kind: 'record',
      entries: [{ key: 'read', value: callback }],
      type: { kind: 'object', fields: [{ name: 'read', type: callback.type }] },
      span: call.span,
    };
    rejectsAssignment(ir);
  });

  it('rejects a coherent __proto__ source in serialized IR', () => {
    const ir = forgery(),
      source = assignments(ir)[0].arguments[1];
    if (
      source.kind !== 'record' ||
      typeof source.type === 'string' ||
      source.type.kind !== 'record'
    )
      throw new Error('Expected the finite test source.');
    source.entries[0].key = '__proto__';
    source.type.fields[0].name = '__proto__';
    rejectsAssignment(ir);
  });

  it('independently rejects a fabricated enriched Error result type', () => {
    const ir = forgery();
    assignments(ir)[0].type = { kind: 'record', fields: [{ name: 'code', type: 'string' }] };
    expect(validateIR(ir).ok).toBe(false);
  });

  it('admits fresh GPUI plain records while retaining native Error and Qt/Flutter diagnostics', () => {
    const text = program(`Object.assign({},{value:1});`),
      ir = portable(text);
    expect(compilePrototype(text, { profile: 'gpui-source-v1' }).ok).toBe(true);
    for (const result of [
      compilePrototype(program("Object.assign(new Error('x'),{value:1});"), {
        profile: 'gpui-source-v1',
      }),
      emitQtSource(ir),
      emitFlutterSource(ir),
    ]) {
      expect(result.ok).toBe(false);
      if (!result.ok)
        expect(
          result.diagnostics.some(
            (diagnostic) =>
              diagnostic.code === 'PUI4003' && diagnostic.message.includes('Object.assign')
          )
        ).toBe(true);
    }
  });

  it.each(nativeOwnerProfiles)(
    'preserves native copying, order, identity and exceptions in %s',
    async (profile) => {
      const native = await mountNativeOwner(source, profile);
      cleanup.push(() => native.dispose());
      const api = native.handle.getExposes();
      expect(await native.act(() => api.records())).toEqual({
        keep: 1,
        replace: 2,
        tail: 3,
        trace: 'target;first;second;',
      });
      expect(await native.act(() => api.nestedIdentity())).toEqual({ same: true, value: 7 });
      expect(await native.act(() => api.errorIdentity())).toBe(true);
      expect(await native.act(() => api.zeroSources())).toBe(4);
      expect(await native.act(() => api.unusedResult())).toBe('unused-target;unused-source;');
      expect(await native.act(() => api.throwingArgument())).toEqual({
        same: true,
        trace: 'before;throws;',
      });

      const previous = Object.getOwnPropertyDescriptor(Error.prototype, 'assignProbe');
      const receivers: { value: unknown; error: boolean }[] = [];
      try {
        Object.defineProperty(Error.prototype, 'assignProbe', {
          configurable: true,
          set(this: object, value: unknown) {
            receivers.push({ value, error: this instanceof Error });
            throw false;
          },
        });
        expect(await native.act(() => api.nativeSetter())).toEqual({
          same: true,
          trace: 'target;source;tail;',
        });
        expect(receivers).toEqual([{ value: 1, error: true }]);
      } finally {
        if (previous) Object.defineProperty(Error.prototype, 'assignProbe', previous);
        else Reflect.deleteProperty(Error.prototype, 'assignProbe');
      }
    }
  );

  it.each(nativeOwnerProfiles)(
    'keeps a shadowed Object.assign as an ordinary call in %s',
    async (profile) => {
      const text = program(`
      function ordinary(){
        const Object={assign:(left:number,right:number)=>left+right};
        return Object.assign(2,3);
      }
      def.expose.method('value',()=>ordinary());
    `);
      expect(assignments(portable(text))).toHaveLength(0);
      const native = await mountNativeOwner(text, profile);
      cleanup.push(() => native.dispose());
      expect(await native.act(() => native.handle.getExposes().value())).toBe(5);
    }
  );
});
