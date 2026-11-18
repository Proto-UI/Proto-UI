// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const prefix = `import {defineHook,defineAsHook,definePrototype,type OwnedStateHandle,type AsHookResult} from '@proto.ui/core';`;
const init = `() => { const flag=def.state.bool('flag',true); def.expose.method('readFlag',()=>flag.get()); }`;
const makeSource = (route: 'direct' | 'factory') => `${prefix}
  const install=defineHook<{}, {}, {state:{flag:OwnedStateHandle<boolean>}}, {init:()=>void}>({
    name:'options-capture',setup(def,options){options.init();}
  });
  export default definePrototype({name:'options-capture-owner',setup(def){
    ${route === 'direct' ? `const captured=install({init:${init}});` : `const make=(callback:()=>void)=>({init:()=>callback()}); const alias=make; const options=alias(${init}); const captured=install(options);`}
    const flag=captured.getState?.('flag');
    def.expose.value('flagValue',flag?.get());
    return r=>r.el('div',[]);
  }});`;

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it.each(['direct', 'factory'] as const)(
      'derives typed capture from %s callable options',
      async (route) => {
        const owner = await mountNativeOwner(makeSource(route), profile);
        cleanup.push(owner.dispose);
        expect(owner.handle.getExposes().flagValue).toBe(true);
        expect(owner.handle.getExposes().readFlag()).toBe(true);
        const capture = owner.compiled.ir.hooks.find(
          (hook) => hook.name === 'options-capture'
        )?.capture;
        expect(capture?.states).toEqual([{ name: 'flag', type: 'state:boolean' }]);
        expect(capture?.methods.map((method) => method.name)).toEqual(['readFlag']);
      }
    );

    it('keeps distinct multiple installations while unioning possible static capture keys', async () => {
      const owner = await mountNativeOwner(
        `${prefix}
      const install=defineHook<{}, {}, {state:{first:OwnedStateHandle<boolean>;second:OwnedStateHandle<number>}}, {init:()=>void}>({
        name:'multiple-options',mode:'multiple',setup(def,options){options.init();}
      });
      export default definePrototype({name:'multiple-options-owner',setup(def){
        const first=install({init:()=>{def.state.bool('first',true);}});
        const second=install({init:()=>{def.state.numberDiscrete('second',2);}});
        def.expose.value('first',first.getState?.('first')?.get());
        def.expose.value('second',second.getState?.('second')?.get());
        def.expose.value('firstLeaksSecond',!!first.getState?.('second'));
        def.expose.value('secondLeaksFirst',!!second.getState?.('first'));
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes()).toMatchObject({
        first: true,
        second: 2,
        firstLeaksSecond: false,
        secondLeaksFirst: false,
      });
      expect(
        owner.compiled.ir.hooks
          .find((hook) => hook.name === 'multiple-options')
          ?.capture?.states.map((state) => state.name)
          .sort()
      ).toEqual(['first', 'second']);
    });

    it('captures option-invoked child hooks without flattening their state into the parent', async () => {
      const owner = await mountNativeOwner(
        `${prefix}
      const inner=defineAsHook<{}, {}, {state:{flag:OwnedStateHandle<boolean>}}>({name:'inner',setup(def){def.state.bool('flag',true);}});
      const outer=defineHook<{}, {}, {state:{flag:OwnedStateHandle<boolean>};asHooks:{inner:AsHookResult<{}, {state:{flag:OwnedStateHandle<boolean>}}>}}, {init:()=>void}>({
        name:'outer-options',setup(def,options){options.init();}
      });
      export default definePrototype({name:'nested-options-owner',setup(def){
        const captured=outer({init:()=>{inner();}});
        const nested=captured.getAsHookHandle?.('inner');
        def.expose.value('outerLeaksState',!!captured.getState?.('flag'));
        def.expose.value('innerState',nested?.getState?.('flag')?.get());
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes()).toMatchObject({ outerLeaksState: false, innerState: true });
      const capture = owner.compiled.ir.hooks.find(
        (hook) => hook.name === 'outer-options'
      )?.capture;
      expect(capture?.states).toEqual([]);
      expect(capture?.children.map((child) => child.name)).toEqual(['inner']);
    });
  });
