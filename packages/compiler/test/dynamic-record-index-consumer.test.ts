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
    it('uses a checked runtime guard for dynamic data beyond the declared structural fields', async () => {
      const owner = await mountNativeOwner(
        `import {definePrototype} from '@proto.ui/core';
        export default definePrototype({name:'checked-dynamic-record',setup(def){
          const read=(box:{n:number},key:string)=>{
            const value=box[key];
            return typeof value==='number'?value+1:0;
          };
          // Exercise width subtyping inside authored code; public data validators
          // may reject undeclared incoming fields independently of this type rule.
          def.expose.method('text',(key:string)=>read({n:2,extra:'text'},key));
          def.expose.method('numeric',(key:string)=>read({n:2,extra:4},key));
          return r=>r.el('output',[]);
        }});`,
        profile
      );
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.text('n')).toBe(3);
      expect(api.text('absent')).toBe(0);
      expect(api.text('extra')).toBe(0);
      expect(api.numeric('extra')).toBe(5);
    });
  });
