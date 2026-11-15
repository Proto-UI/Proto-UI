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
    it('does not expose the mutable internal registry through getExposes', async () => {
      const owner = await mountNativeOwner(
        `import{definePrototype}from'@proto.ui/core';
      export default definePrototype({name:'public-registry',setup(def){
        def.expose.method('read',()=>1);
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      const snapshot = owner.handle.getExposes();
      const read = snapshot.read;
      // Either a detached writable snapshot or a readonly snapshot is legal.
      try {
        snapshot.read = () => 999;
      } catch {}
      const current = owner.handle.getExposes();
      expect(current.read).toBe(read);
      expect(current.read()).toBe(1);
    });
  });
