// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { FunctionIR } from '../src/ir';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { localNominalHelperSource as source } from './local-nominal-helper-fixture';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

function parseBody(body: string) {
  return parsePrototype(`import{definePrototype}from'@proto.ui/core';
    import{asFocusable}from'@proto.ui/hooks';
    export default definePrototype({name:'local-parameter-proof',setup(def){${body}}});`);
}

describe('local nominal parameter inference', () => {
  it('retains one authored closure and independently checks its cold IR', () => {
    const result = parsePrototype(source);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
    const helpers: FunctionIR[] = [];
    JSON.stringify(result.value, (_key, value) => {
      if (value?.kind === 'const' && value.name === 'change') {
        expect(value.value.kind).toBe('function');
        helpers.push(value.value.function);
      }
      return value;
    });
    expect(helpers).toHaveLength(1);
    expect(helpers[0].parameters[0].type).toBe('run-lifecycle');
    expect(result.value.sourceFiles[0].content).toBe(source);
    const cold = JSON.parse(JSON.stringify(result.value));
    let changed = 0;
    JSON.stringify(cold, (_key, value) => {
      if (value?.kind === 'operation' && value.operation === 'lifecycle.setPresentFromModule') {
        value.receiver = {
          kind: 'record',
          entries: [],
          type: { kind: 'record', fields: [] },
          span: value.span,
        };
        changed++;
      }
      return value;
    });
    expect(changed).toBe(1);
    expect(validateIR(cold)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('derives all nominal arguments without depending on the helper spelling', () => {
    const result = parseBody(`
      const first=def.state.bool('first',true),second=def.state.bool('second',false);
      function transfer(source:{get():boolean},target:{set(value:boolean):void}){
        target.set(source.get());
      }
      def.lifecycle.onCreated(()=>transfer(first,second));
      def.expose.method('read',()=>second.get());
    `);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
    expect(parsePrototype(source.replaceAll('change', 'rotateView'))).toMatchObject({ ok: true });
  });

  it('keeps shadowed helper declarations independent', () => {
    const result = parseBody(`
      const first=def.state.bool('first',true),second=def.state.numberDiscrete('second',3);
      const read=(value:{get():boolean})=>value.get();
      def.lifecycle.onCreated(()=>read(first));
      def.lifecycle.onMounted(()=>{
        const read=(value:{get():number})=>value.get();read(second);
      });
    `);
    if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
  });

  it.each([
    ['boolean', true],
    ['number', false],
  ] as const)('keeps repeated generic source instances stable for %s', (second, accepted) => {
    const result = parsePrototype(`import{definePrototype}from'@proto.ui/core';
        function inspect<T>(value:{get():T}){
          const read=(state:{get():T})=>state.get();return read(value);
        }
        export default definePrototype({name:'shared-local-source',setup(def){
          const one=def.state.bool('one',false),two=${
            second === 'boolean'
              ? `def.state.bool('two',true)`
              : `def.state.numberDiscrete('two',1)`
          };
          def.lifecycle.onCreated(()=>{inspect<boolean>(one);inspect<${second}>(two);});
        }});`);
    if (accepted) {
      if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
      expect(validateIR(JSON.parse(JSON.stringify(result.value)))).toMatchObject({ ok: true });
    } else expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it.each([
    `const value=def.state.numberDiscrete('value',0);
      const apply=(state:{set(next:boolean):void})=>state.set(true);
      def.lifecycle.onCreated(()=>apply(value));`,
    `const value=asFocusable().focused;
      const apply=(state:{set(next:boolean):void})=>state.set(true);
      def.lifecycle.onCreated(()=>apply(value));`,
    `const value=def.state.bool('value',false);
      const apply=(state:{set(next:boolean):void})=>state.set(true);apply(value);`,
    `const apply=(module:{setPresent(next:boolean):void})=>module.setPresent(false);
      def.lifecycle.onBeforeDispose(run=>apply(run.lifecycle));`,
    `const apply=(module:{setPresent(next:boolean):void})=>module.setPresent(false);
      def.lifecycle.onCreated(run=>{apply(run.lifecycle);apply({setPresent(next:boolean){}});});`,
    `const apply=(module:{setPresent(next:boolean):void})=>module.setPresent(false);
      def.lifecycle.onCreated(run=>{apply({setPresent(next:boolean){}});apply(run.lifecycle);});`,
    `const apply=(module:{setPresent(next:boolean):void})=>module.setPresent(false);
      def.lifecycle.onCreated(run=>apply(run.lifecycle));def.expose.method('apply',apply);`,
    `const apply=(module:{setPresent(next:boolean):void})=>module.setPresent(false);
      const hidden={invoke:apply};
      def.lifecycle.onCreated(run=>apply(run.lifecycle));def.expose.method('apply',hidden.invoke);`,
    `const apply=(module:{setPresent(next:boolean):void})=>module.setPresent(false);
      def.lifecycle.onCreated(run=>apply(run.lifecycle));def.expose.method('get',()=>({apply}));`,
    `const first=def.state.bool('first',false),second=def.state.numberDiscrete('second',0);
      const read=(state:{get():boolean|number})=>state.get();
      def.lifecycle.onCreated(()=>{read(first);read(second);});`,
    `let apply=(module:{setPresent(next:boolean):void})=>module.setPresent(false);
      def.lifecycle.onCreated(run=>apply(run.lifecycle));`,
    `const apply=(module:{setPresent(next:boolean):void},other:boolean)=>module.setPresent(other);
      def.lifecycle.onCreated(run=>apply(run.lifecycle,1));`,
    `const apply:(module:{setPresent(next:boolean):void})=>void=(module)=>module.setPresent(false);
      def.lifecycle.onCreated(run=>apply(run.lifecycle));`,
    `def.lifecycle.onCreated(run=>{const fake=run.lifecycle as {setPresent(next:boolean):void};});`,
  ])('preserves caller, escape, type and phase boundaries: %s', (body) => {
    expect(parseBody(body)).toMatchObject({ ok: false });
  });

  for (const profile of nativeOwnerProfiles)
    it(`preserves closure/module identity and distinct owners in ${profile}`, async () => {
      const first = await mountNativeOwner(source, profile);
      cleanup.push(first.dispose);
      const second = await mountNativeOwner(source, profile);
      cleanup.push(second.dispose);
      const firstApi = first.handle.getExposes(),
        secondApi = second.handle.getExposes();
      expect(firstApi.same()).toBe(true);
      expect(secondApi.same()).toBe(true);
      expect(firstApi.counts()).toEqual({ writes: 1, mounted: 0, unmounted: 0 });
      await first.act(() => firstApi.change(true));
      expect(firstApi.counts()).toEqual({ writes: 2, mounted: 1, unmounted: 0 });
      expect(secondApi.counts()).toEqual({ writes: 1, mounted: 0, unmounted: 0 });
      await first.act(() => firstApi.change(false));
      expect(firstApi.counts()).toEqual({ writes: 3, mounted: 1, unmounted: 1 });
      const old = firstApi.change;
      await first.dispose();
      expect(() => old(true)).toThrow(/dispos|alive|terminal/i);
      await second.act(() => secondApi.change(true));
      expect(secondApi.counts()).toEqual({ writes: 2, mounted: 1, unmounted: 0 });
    });
});
