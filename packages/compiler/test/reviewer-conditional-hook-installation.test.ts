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

    it('excludes a definitely skipped once setup from capability demand', async () => {
      const owner = await mountNativeOwner(
        `
      import {defineHook,definePrototype} from '@proto.ui/core';
      import {asOverlay} from '@proto.ui/hooks';
      const install=defineHook<{}, {}, {}, {init:()=>void}>({name:'definite-once',setup(def,options){options.init();}});
      export default definePrototype({name:'definite-once-owner',setup(def){
        install({init:()=>{}});
        install({init:()=>{asOverlay();}});
        def.expose.value('installed',true);
        return r=>r.el('div',[]);
      }});`,
        profile
      );
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes().installed).toBe(true);
      expect(owner.compiled.output.dependencies.map((item) => item.name)).not.toContain(
        '@floating-ui/dom'
      );
      expect(
        owner.compiled.output.supportingFiles?.filter((file) => file.path.includes('/interaction/'))
      ).toEqual([]);
    });
  });
