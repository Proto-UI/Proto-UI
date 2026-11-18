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
    it('observes current data fields when a public method returns the same mutable callable record again', async () => {
      const owner = await mountNativeOwner(
        `import { definePrototype } from '@proto.ui/core';
      export default definePrototype({name:'mutable-public-record',setup(def){
        let count=0;
        const record={value:0,next:()=>++count};
        def.expose.method('step',()=>{record.value=record.value+1;return record.value;});
        def.expose.method('read',()=>record);
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      const before = api.read();
      expect(before.value).toBe(0);
      expect(api.step()).toBe(1);
      const after = api.read();
      expect(after.value).toBe(1);
      expect(after).toBe(before);
      expect(after.next).toBe(before.next);
    });
  });
