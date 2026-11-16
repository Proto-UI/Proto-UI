// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

function source(body: string): string {
  return `import{definePrototype}from'@proto.ui/core';export default definePrototype({name:'review-public-callables',setup(def){${body}return r=>r.el('output',[r.slot()]);}});`;
}

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('enters callback scope for a callable returned by a public method', async () => {
      const owner = await mountNativeOwner(
        source(`
      const count=def.state.numberDiscrete('count',0);
      const increment=()=>{count.set(count.get()+1);return count.get();};
      def.expose.method('factory',()=>increment);
    `),
        profile
      );
      cleanup.push(owner.dispose);
      const increment = owner.handle.getExposes().factory();
      expect(increment()).toBe(1);
    });

    it('invalidates a returned pure lexical closure when its owner is terminally disposed', async () => {
      const owner = await mountNativeOwner(
        source(`
      let count=0;const increment=()=>++count;
      def.expose.method('factory',()=>({increment}));
    `),
        profile
      );
      cleanup.push(owner.dispose);
      const retained = owner.handle.getExposes().factory();
      expect(retained.increment()).toBe(1);
      await owner.dispose();
      expect(() => retained.increment()).toThrow(/dispos|alive|terminal/i);
    });

    it('retains alias identity across data and callable-record exposure boundaries', async () => {
      const owner = await mountNativeOwner(
        source(`
      const data={value:1};const action={next:()=>2};
      def.expose.value('dataA',data);def.expose.value('dataB',data);
      def.expose.value('actionA',action);def.expose.value('actionB',action);
    `),
        profile
      );
      cleanup.push(owner.dispose);
      const publicValues = owner.handle.getExposes();
      expect(publicValues.dataA).toBe(publicValues.dataB);
      expect(publicValues.actionA.next).toBe(publicValues.actionB.next);
      expect(publicValues.actionA).toBe(publicValues.actionB);
    });
  });
