// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = `import {definePrototype} from '@proto.ui/core';
  function enable(value:{set(next:boolean,reason?:string):void}){value.set(true,'enabled');}
  function read(value:{get():boolean|number}):boolean|number{return value.get();}
  export default definePrototype({name:'nominal-helper-interface',setup(def){
    const enabled=def.state.bool('enabled',false);
    const count=def.state.numberDiscrete('count',41);
    def.lifecycle.onCreated(()=>enable(enabled));
    def.expose.method('readEnabled',()=>read(enabled));
    def.expose.method('readCount',()=>read(count));
    return r=>r.el('output',[]);
  }});`;
const dispose: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of dispose.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});

describe('closed helpers retain nominal capability interfaces', () => {
  it('keeps distinct boolean/number receiver identities through cold IR', () => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    expect(validateIR(JSON.parse(JSON.stringify(parsed.value)))).toMatchObject({ ok: true });
    const receivers = (parsed.value.moduleBindings ?? []).flatMap((binding) =>
      binding.value.kind === 'function'
        ? binding.value.function.parameters.map((parameter) => parameter.type)
        : []
    );
    expect(receivers).toContain('state:boolean');
    expect(receivers).toContain('state:number');
  });

  it.each([
    `const value=def.state.numberDiscrete('value',0);def.lifecycle.onCreated(()=>enable(value));`,
    `const value=asFocusable().focused;def.lifecycle.onCreated(()=>enable(value));`,
    `const value=def.state.bool('value',false);enable(value);`,
    `function watcher(value:{watch(callback:()=>void):void}){}
      watcher(def.state.bool('value',false));`,
    `function empty(value:{}){}empty(null);`,
    `function empty(value:{}){}def.expose.method('unknown',(value:unknown)=>empty(value));`,
  ])('retains type, ownership and phase refusals: %s', (body) => {
    expect(
      parsePrototype(`import {definePrototype} from '@proto.ui/core';
      import {asFocusable} from '@proto.ui/hooks';
      function enable(value:{set(next:boolean,reason?:string):void}){value.set(true,'enabled');}
      export default definePrototype({name:'nominal-refusal',setup(def){${body}}});`)
    ).toMatchObject({ ok: false });
  });

  it('does not accept a serialized structural record as the nominal receiver proof', () => {
    const parsed = parsePrototype(source);
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
    const ir = JSON.parse(JSON.stringify(parsed.value));
    let changed = 0;
    for (const binding of ir.moduleBindings ?? []) {
      if (binding.value.kind !== 'function') continue;
      for (const parameter of binding.value.function.parameters)
        if (parameter.type === 'state:boolean') {
          parameter.type = { kind: 'object', fields: [] };
          changed++;
        }
    }
    expect(changed).toBeGreaterThan(0);
    expect(validateIR(ir)).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI2002' }] });
  });

  for (const profile of nativeOwnerProfiles)
    it(`executes the authored helper calls with their original receivers in ${profile}`, async () => {
      const owner = await mountNativeOwner(source, profile);
      dispose.push(owner.dispose);
      expect(owner.handle.getExposes().readEnabled()).toBe(true);
      expect(owner.handle.getExposes().readCount()).toBe(41);
    });
});
