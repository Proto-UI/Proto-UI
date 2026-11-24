// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import Vue2 from '../../adapters/vue2/node_modules/vue';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

it.each([
  "def.expose.method('shared',()=>1);",
  "const state=def.state.bool('checked',false);def.expose.state('shared',state);",
  "def.expose.event('shared',{payload:'void'});",
])('Vue2 rejects duplicate Hook exposes and retires failed setup: %s', async (declaration) => {
  const errors: unknown[] = [];
  const previousHandler = Vue2.config.errorHandler;
  Vue2.config.errorHandler = (error) => {
    errors.push(error);
  };
  try {
    const source = `import{defineAsHook,definePrototype}from'@proto.ui/core';
      const left=defineAsHook({name:'first-declaration',setup(def){${declaration}}});
      const right=defineAsHook({name:'second-declaration',setup(def){${declaration}}});
      export default definePrototype({name:'duplicate-hook-expose',setup(def){
        left();right();return r=>r.el('output','should-not-mount');
      }});`;
    let owner: Awaited<ReturnType<typeof mountNativeOwner>> | undefined;
    try {
      owner = await mountNativeOwner(source, 'vue2-source-v1');
    } catch (error) {
      errors.push(error);
    }
    if (owner) {
      cleanup.push(owner.dispose);
      expect(owner.handle.getExposes()).toEqual({});
      expect(owner.host.textContent).not.toContain('should-not-mount');
    }
    expect(
      errors.some(
        (error) => error instanceof Error && /duplicate.*declaration/i.test(error.message)
      )
    ).toBe(true);
  } finally {
    Vue2.config.errorHandler = previousHandler;
  }
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
