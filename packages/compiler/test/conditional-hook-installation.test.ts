// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = (initial: boolean, mode: 'once' | 'multiple' = 'once') => `
import { defineHook, definePrototype } from '@proto.ui/core';
const install = defineHook<{}, {}, {}, { init: () => void }>({
  name: 'conditional-once', mode: '${mode}',
  setup(def, options) { options.init(); },
});
export default definePrototype({ name: 'conditional-once-owner', setup(def) {
  let count = 0;
  const choice = def.state.bool('choice', ${initial});
  if (choice.get()) install({ init: () => {} });
  install({ init: () => { count = 1; } });
  def.expose.method('read', () => count);
  return r => r.el('div', []);
}});`;

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it.each([false, true])(
      'retains the actual first once installation when earlier conditional is %s',
      async (initial) => {
        const owner = await mountNativeOwner(source(initial), profile);
        cleanup.push(owner.dispose);
        expect(owner.handle.getExposes().read()).toBe(initial ? 0 : 1);
      }
    );

    it('keeps the multiple-installation control', async () => {
      const owner = await mountNativeOwner(source(true, 'multiple'), profile);
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes().read()).toBe(1);
    });
  });

for (const profile of nativeOwnerProfiles) {
  it(`${profile} preserves a failed first registration through a catch and later same-name call`, async () => {
    const owner = await mountNativeOwner(
      `
      import {defineHook,definePrototype} from '@proto.ui/core';
      const install=defineHook<{}, {}, {}, {init:()=>void}>({name:'failed-once',setup(def,options){options.init();}});
      export default definePrototype({name:'failed-once-owner',setup(def){
        let count=0; const choice=def.state.bool('choice',false);
        if(choice.get())install({init:()=>{}});
        try { install({init:()=>{count=1;throw 'failed';}}); } catch {}
        install({init:()=>{count=2;}});
        def.expose.method('read',()=>count);return r=>r.el('div',[]);
      }});`,
      profile
    );
    cleanup.push(owner.dispose);
    expect(owner.handle.getExposes().read()).toBe(1);
  });
}
