// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import type { PrototypeIR } from '../src/ir';

const core = `import {defineHook,defineAsHook,definePrototype} from '@proto.ui/core';`;
function checked(source: string): PrototypeIR {
  const result = parsePrototype(source);
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const serialized = JSON.parse(JSON.stringify(result.value));
  const portable = validateIR(serialized);
  if (!portable.ok) throw new Error(JSON.stringify(portable.diagnostics));
  return portable.value;
}

describe('ordinary functions and authored hook lifecycles', () => {
  it('captures explicitly exposed Focus facts under their stable observed names', () => {
    const source = `${core}
      import {asFocusable} from '@proto.ui/hooks';
      const child=defineAsHook({name:'child',setup(def){def.state.bool('privateFlag',true);}});
      const focusFacts=defineAsHook({name:'focus-facts',setup(def){
        child();
        const {focusVisible: visible}=asFocusable();
        def.expose.state('publicVisibility',visible);
      }});
      export default definePrototype({name:'consumer',setup(def){
        const result=focusFacts();
        const {focusVisible}=result.stateHandles;
        const byName=result.getState('focusVisible');
        def.expose.method('read',()=>byName?.get() ?? focusVisible.get());
      }});`;
    const capture = checked(source).hooks.find((hook) => hook.name === 'focus-facts')?.capture;
    expect(capture?.states).toEqual([
      { name: 'focusVisible', type: 'observed:boolean', definite: true },
    ]);
    expect(capture?.children.map((child) => child.name)).toEqual(['child', 'asFocusable']);
    for (const write of [
      'focusVisible.setDefault(true);',
      'if(byName)byName.setDefault(true);',
      "def.expose.method('write',()=>focusVisible.set(true));",
      "def.expose.method('write',()=>byName?.set(true));",
    ]) {
      const rejected = parsePrototype(source.replace("def.expose.method('read'", `${write}def.expose.method('read'`));
      expect(rejected).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
    }
  });

  it('reads definite named states through a readonly borrowed capture record', () => {
    const ir = checked(`${core}
      const install=defineAsHook({name:'named-state',setup(def){const flag=def.state.bool('flag',true);}});
      export default definePrototype({name:'owner',setup(def){const {flag}=install().stateHandles;def.expose.method('read',()=>flag.get());}});`);
    expect(ir.hooks[0].capture?.states).toEqual([{name:'flag',type:'state:boolean',definite:true}]);
    const forged=JSON.parse(JSON.stringify(ir));
    delete forged.hooks[0].capture.states[0].definite;
    expect(validateIR(forged)).toMatchObject({ok:false});
  });

  it.each([
    `if(true){def.state.bool('flag',true);}`,
    `try{def.state.bool('flag',true);}finally{}`,
    `const declare=()=>def.state.bool('flag',true);declare();`,
  ])('keeps non-definite named states optional: %s', (body) => {
    const ir=checked(`${core}const install=defineAsHook({name:'optional-state',setup(def){${body}}});
      export default definePrototype({name:'owner',setup(def){const handles=install().stateHandles;if(handles){const flag=handles.flag;if(flag){def.expose.method('read',()=>flag.get());}}}});`);
    expect(ir.hooks[0].capture?.states.every((state)=>!state.definite)).toBe(true);
  });

  it.each(['once', 'multiple', 'configurable'] as const)(
    'checks %s setup/options/API/configuration without creating a component protocol',
    (mode) => {
      const ir = checked(`${core}
      const install=defineHook<{}, {}, {}, number>({name:'count',mode:'${mode}',
        setup(def,options,api){api.store.count=options;const state=def.state.numberDiscrete('count',options);def.expose.state('count',state);},
        configure(api,options,tools){const prior=api.store.count;if(typeof prior==='number'){api.store.count=prior+options;}else{tools.conflict('missing count');}}
      });
      export default definePrototype({name:'counter',setup(def){const first=install(1);const second=install(2);}});`);
      expect(ir.hooks[0]).toMatchObject({
        kind: 'hook',
        mode,
        optionsType: 'number',
        setup: { phase: 'setup', context: 'helper' },
        configure: { phase: 'setup', context: 'helper', returnType: 'void' },
      });
      expect(ir.hooks[0].capture?.states).toEqual([{ name: 'count', type: 'state:number', definite: true }]);
    }
  );

  it('retains caller option types even when setup and configure omit their parameters', () => {
    const source = `${core} const install=defineHook<{}, {}, {}, {enabled:boolean}>({name:'options',setup(){}});
      export default definePrototype({name:'owner',setup(){install({enabled:true});}});`;
    expect(checked(source).hooks[0].optionsType).toEqual({
      kind: 'record',
      fields: [{ name: 'enabled', type: 'boolean' }],
    });
    expect(parsePrototype(source.replace('enabled:true', 'enabled:1'))).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI1006' }],
    });
  });

  it('infers hook options from their source annotation and normalizes separate configure functions', () => {
    const ir = checked(`${core}
      import type {HookConfigApi,HookConfigureTools} from '@proto.ui/core';
      function configure(api:HookConfigApi,options:number,tools:HookConfigureTools){api.store.value=options;}
      const alias=configure;
      const install=defineHook({name:'aliases',setup(def,options:number,api){api.store.value=options;},configure:alias});
      export default definePrototype({name:'owner',setup(){install(2);}});`);
    expect(ir.hooks[0].configure?.parameters.map((parameter) => parameter.name)).toEqual([
      'api',
      'options',
      'tools',
    ]);
  });

  it('keeps same-name once as an installation rule, separate from declaration identity', () => {
    const ir = checked(`${core}
      const first=defineAsHook({name:'shared-name',setup(def){def.state.bool('flag',false);}});
      const second=defineAsHook({name:'shared-name',setup(def){def.state.bool('flag',false);}});
      export default definePrototype({name:'owner',setup(){first();second();}});`);
    expect(ir.hooks.map(({ name, mode }) => ({ name, mode }))).toEqual([
      { name: 'shared-name', mode: 'once' },
      { name: 'shared-name', mode: 'once' },
    ]);
    expect(new Set(ir.hooks.map((hook) => hook.id)).size).toBe(2);
  });

  it.each([
    `defineAsHook({name:'invalid',mode:'multiple',setup(){}})`,
    `defineAsHook({name:'invalid',configure(){},setup(){}})`,
    `defineHook({name:'invalid',projectHandle(){},setup(){}})`,
  ])('does not erase an unsupported lifecycle property: %s', (definition) => {
    expect(
      parsePrototype(
        `${core} const install=${definition};export default definePrototype({name:'owner',setup(){install();}});`
      )
    ).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });

  it('revalidates hook invocation and lifecycle signatures in portable IR', () => {
    const source = `${core}const install=defineHook<{}, {}, {}, number>({name:'input',setup(def,value){}});export default definePrototype({name:'owner',setup(){install(1);}});`;
    const ir = checked(source);
    const invocation = ir.setup.body[0];
    if (invocation.kind !== 'effect' || invocation.expression.kind !== 'authored-hook')
      throw new Error('missing invocation');
    invocation.expression.arguments![0] = {
      kind: 'literal',
      value: 'forged',
      type: 'string',
      span: invocation.span,
    };
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
    const signature = checked(source);
    signature.hooks[0].setup.parameters[1].type = 'run';
    expect(validateIR(signature)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  it('does not treat an ordinary setup-time closure factory as a render or installation boundary', () => {
    checked(`${core}export default definePrototype({name:'ordinary-factory',setup(def){
      const create=()=>{const state=def.state.bool('flag',false);return ()=>state.get();};
      const read=create();def.expose.method('read',read);
    }});`);
  });

  it('retains alias binding identity and mixed render-helper return inference', () => {
    checked(`${core}export default definePrototype({name:'ordinary-render',setup(def){const state=def.state.bool('flag',false);return r=>{
      const choose=()=>{if(state.get())return r.el('span','positive');return 'negative';};const alias=choose;return r.el('section',[alias(),r.slot()]);
    };}});`);
    const source = readFileSync(
      new URL('./fixtures/module-lexical-values.proto.ts', import.meta.url),
      'utf8'
    );
    const parsed = parsePrototype(source, { exportName: 'WithState' });
    expect(parsed.ok).toBe(true);
    if (parsed.ok)
      expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
  });

  it.each([
    "const draw=()=> 'hello';return draw;",
    "const draw=()=> 'hello';const alias=draw;return alias;",
    "const draw=()=> 'captured';const id=()=>draw;const wrapper=()=>id();return wrapper();",
    "const factory=(text:string)=>{const draw=()=>text;return draw;};const first=factory('first');const second=factory('second');if(first===second)return second;return first;",
    "const draw=()=> 'x';const factory=()=>draw;const alias=factory();if(alias!==draw)return ()=> 'bad';return draw;",
  ])('adapts an ordinary returned callable only at the setup result boundary: %s', (body) => {
    checked(`${core}export default definePrototype({name:'returned',setup(def){${body}}});`);
  });

  it('checks ordinary configuration transport without inventing a configuration-only source type', () => {
    checked(
      `${core}import{asFocusable}from'@proto.ui/hooks';export default definePrototype({name:'config',setup(def){const flag=def.state.bool('flag',true);const ordinary={disabled:false,meta:{flag}};const identity=()=>ordinary;const config=identity();asFocusable().configure(config);}});`
    );
    const unsafe = `${core}import{asFocusable}from'@proto.ui/hooks';export default definePrototype({name:'config',setup(def){const ordinary={disabled:false,scope:def};asFocusable().configure(ordinary);}});`;
    expect(parsePrototype(unsafe)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
  });
  it('retains a public ordinary callable record at a value operation boundary', () => {
    const ir = checked(`${core}export default definePrototype({name:'public-controls',setup(def){
      let count=0;const controls={increment:()=>++count,read:()=>count};
      def.expose.value('named',controls);
      def.expose.value('inline',{increment:()=>++count,read:()=>count});
    }});`);
    expect(
      ir.exposes.map((exposure) => (exposure.kind === 'value' ? exposure.type : undefined))
    ).toEqual([
      expect.objectContaining({ kind: 'object' }),
      expect.objectContaining({ kind: 'object' }),
    ]);
  });
  it.each([
    "const create=()=>def.state.bool('flag',true);create();",
    "const create=()=>def.state.bool('flag',true);const alias=create;alias();",
    "const create=()=>def.state.bool('flag',true);const box={create};box.create();",
    "const factory=()=>()=>def.state.bool('flag',true);factory()();",
    "const factory=()=>{const create=()=>def.state.bool('flag',true);return {create};};factory().create();",
    "const invoke=(create:()=>void)=>create();invoke(()=>{def.state.bool('flag',true);});",
  ])('derives the same direct hook capture through ordinary call transport: %s', (body) => {
    const ir = checked(
      `${core}const install=defineAsHook({name:'capture',setup(def){${body}const unused=()=>def.state.bool('unreached',false);}});export default definePrototype({name:'owner',setup(def){const h=install();def.expose.method('read',()=>h.getState('flag')?.get());}});`
    );
    expect(ir.hooks[0].capture?.states).toEqual([{ name: 'flag', type: 'state:boolean' }]);
    const forged = JSON.parse(JSON.stringify(ir));
    forged.hooks[0].capture.states = [];
    expect(validateIR(forged)).toMatchObject({
      ok: false,
      diagnostics: [{ code: 'PUI2002' }],
    });
  });

  it('keeps a returned capture factory in its declaration environment', () => {
    const ir = checked(
      `${core}const install=defineAsHook({name:'capture',setup(def){const create=()=>def.state.bool('outer',true);const factory=()=>{const create=()=>def.state.bool('inner',true);return create;};factory()();create();}});export default definePrototype({name:'owner',setup(){install();}});`
    );
    expect(ir.hooks[0].capture?.states.map((state) => state.name)).toEqual(['inner', 'outer']);
  });
});
