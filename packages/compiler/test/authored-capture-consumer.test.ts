// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it.each(['once', 'multiple'] as const)(
      'preserves %s capture identity and direct state ownership',
      async (mode) => {
        const owner = await mountNativeOwner(
          `import{definePrototype,defineHook}from'@proto.ui/core';
const install=defineHook<{}, {}, {}, number>({name:'captured-count',mode:'${mode}',setup(def,value){def.state.numberDiscrete('count',value);}});
export default definePrototype({name:'capture-consumer',setup(def){
 const first=install(1);const second=install(2);
 def.expose.method('first',()=>first.getState?.('count')?.get() ?? -1);
 def.expose.method('second',()=>second.getState?.('count')?.get() ?? -1);
 def.expose.method('same',()=>first===second);
 return r=>r.el('output',[r.slot()]);
}});`,
          profile
        );
        cleanups.push(owner.dispose);
        const exposed = owner.handle.getExposes();
        expect(exposed.first()).toBe(1);
        expect(exposed.second()).toBe(mode === 'once' ? 1 : 2);
        expect(exposed.same()).toBe(mode === 'once');
      },
      30_000
    );

    it('runs initial and later configuration against one owner-local API store', async () => {
      const source = `import{definePrototype,defineHook}from'@proto.ui/core';
const install=defineHook<{}, {}, {}, number>({name:'configurable-count',mode:'configurable',
 setup(def,value,api){api.store.count=0;def.expose.method('calls',()=>{const count=api.store.count;return typeof count==='number'?count:-1;});},
 configure(api,value,tools){const count=api.store.count;if(typeof count==='number'){api.store.count=count+value;}else{tools.conflict('missing count');}}
});
export default definePrototype({name:'configured-consumer',setup(def){install(2);install(3);return r=>r.el('output',[r.slot()]);}});`;
      const first = await mountNativeOwner(source, profile),
        second = await mountNativeOwner(source, profile);
      cleanups.push(first.dispose, second.dispose);
      const retained = first.handle.getExposes().calls;
      expect(retained()).toBe(5);
      expect(second.handle.getExposes().calls()).toBe(5);
      await first.dispose();
      expect(() => retained()).toThrow(/dispos|alive|terminal/i);
      expect(second.handle.getExposes().calls()).toBe(5);
    }, 30_000);
  });
