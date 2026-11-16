// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});
for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('retains a nested privileged installation as a child capture', async () => {
      const owner = await mountNativeOwner(
        `import{definePrototype,defineAsHook}from'@proto.ui/core';import{asFocusable}from'@proto.ui/hooks';
      const install=defineAsHook({name:'outer',setup(){asFocusable();}});
      export default definePrototype({name:'capture-host-child',setup(def){
        const result=install();
        def.expose.value('hasChild',!!result.getAsHook?.('asFocusable'));
        def.expose.value('hasHandle',!!result.getAsHookHandle?.('asFocusable'));
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      const exposed = owner.handle.getExposes();
      expect(exposed.hasChild).toBe(true);
      expect(exposed.hasHandle).toBe(true);
    });
    it('preserves the reused privileged raw result, handle, and registration order', async () => {
      const owner = await mountNativeOwner(
        `import{definePrototype,defineAsHook}from'@proto.ui/core';import{asFocusable}from'@proto.ui/hooks';
      const after=defineAsHook({name:'after',setup(){}});
      const install=defineAsHook({name:'outer',setup(){asFocusable();after();asFocusable();}});
      export default definePrototype({name:'capture-reused-child',setup(def){
        const raw=asFocusable();const result=install();
        const child=result.getAsHook?.('asFocusable');
        def.expose.value('sameRaw',child?.result===raw);
        def.expose.value('sameHandle',result.getAsHookHandle?.('asFocusable')===raw);
        def.expose.value('order',child?.order);
        def.expose.value('afterOrder',result.getAsHook?.('after')?.order);
        def.expose.value('privileged',child?.privileged);
        def.expose.value('mode',child?.mode);
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes()).toMatchObject({
        sameRaw: true,
        sameHandle: true,
        order: 0,
        afterOrder: 2,
        privileged: true,
        mode: 'once',
      });
    });
    it.each(['asFocusable();named();', 'named();asFocusable();'])(
      'keeps authored and privileged registration namespaces distinct: %s',
      async (calls) => {
        const owner = await mountNativeOwner(
          `import{definePrototype,defineAsHook}from'@proto.ui/core';import{asFocusable}from'@proto.ui/hooks';
      const named=defineAsHook({name:'asFocusable',setup(){}});
      export default definePrototype({name:'capture-registration-kind',setup(def){
        let conflict=false;try{${calls}}catch{conflict=true;}
        def.expose.value('conflict',conflict);
        return r=>r.el('div',[]);
      }});`,
          profile
        );
        cleanup.push(owner.dispose);
        expect(owner.handle.getExposes().conflict).toBe(true);
      }
    );
  });
