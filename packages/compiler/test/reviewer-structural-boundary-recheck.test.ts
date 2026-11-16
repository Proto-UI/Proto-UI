// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { parsePrototype } from '../src/parser';
import { validateIR } from '../src/ir-validation';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

it.each([
  `let saved:number|{value:number}=0;
   export default definePrototype({name:'hidden-module-owner',setup(def){
     let count=0;const raw={value:1,next:()=>++count};saved=raw;def.expose.value('saved',saved);
   }});`,
  `export default definePrototype({name:'hidden-callable',setup(def){
     let count=0;const raw={value:1,next:()=>++count};const safe:{value:number}=raw;
     def.expose.value('safe',safe);def.expose.value('raw',raw);
   }});`,
  `export default definePrototype({name:'hidden-owner',setup(def){
     const raw={value:1,secret:def};const safe:{value:number}=raw;def.expose.value('safe',safe);
   }});`,
])('rejects the original authority-erasing source at its declaration boundary: %s', (body) => {
  const result = parsePrototype(`import{definePrototype}from'@proto.ui/core';${body}`);
  expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'PUI1006' }] });
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('preserves legal pure-data width subtyping and complete callable-record aliases', async () => {
      const source = `import{definePrototype}from'@proto.ui/core';
      export default definePrototype({name:'complete-view',setup(def){
        const rawData={value:1,extra:2};const dataView:{value:number}=rawData;
        let count=0;const rawCallable={value:1,next:()=>++count};
        const callableView:{value:number;next:()=>number}=rawCallable;
        def.expose.value('data',rawData);def.expose.value('dataView',dataView);
        def.expose.value('callable',rawCallable);def.expose.value('callableView',callableView);
        return r=>r.el('div',[]);
      }});`;
      const parsed = parsePrototype(source);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) expect(validateIR(JSON.parse(JSON.stringify(parsed.value))).ok).toBe(true);
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.dataView).toBe(api.data);
      expect(api.dataView.extra).toBe(2);
      expect(api.callableView).toBe(api.callable);
      expect(api.callableView.next()).toBe(1);
      const retained = api.callableView;
      await owner.dispose();
      expect(() => retained.next()).toThrow(/dispos|alive|terminal/i);
    });
  });
