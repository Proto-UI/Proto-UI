// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  vi.useRealTimers();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('evaluates owner-dependent module defaults lazily in the current owner', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      const owner = await mountNativeOwner(
        `import {definePrototype,delay} from '@proto.ui/core';
        let completed=0;
        function wait(task=delay(0,()=>{completed++;})){return 1;}
        function forwarded(value=wait()){return value;}
        function throughReference(helper=wait){return helper();}
        function scalar(value=7){return value;}
        export default definePrototype({name:'module-default-owner',setup(def){
          def.expose.method('wait',()=>wait());
          def.expose.method('forwarded',forwarded);
          def.expose.method('throughReference',()=>throughReference());
          def.expose.method('scalar',scalar);
          def.expose.method('completed',()=>completed);
          return r=>r.el('output',[]);
        }});`,
        profile
      );
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.scalar()).toBe(7);
      expect(api.forwarded(9)).toBe(9);
      expect(api.completed()).toBe(0);
      expect(api.wait()).toBe(1);
      expect(api.forwarded()).toBe(1);
      expect(api.throughReference()).toBe(1);
      expect(api.completed()).toBe(0);
      await owner.act(() => vi.runOnlyPendingTimers());
      expect(api.completed()).toBe(3);
      expect(api.forwarded(undefined)).toBe(1);
      await owner.dispose();
      await vi.runOnlyPendingTimersAsync();
      expect(() => api.wait()).toThrow(/dispos|alive|terminal/i);
    });
  });
