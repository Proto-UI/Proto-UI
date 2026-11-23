// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { moduleCallableFixture } from './module-callable-selection-fixture';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it.each([true, false])(
      'executes the selected module callable in the actual owner: enabled=%s',
      async (enabled) => {
        const { source, options } = moduleCallableFixture(enabled);
        const owner = await mountNativeOwner(source, profile, { compile: options });
        cleanup.push(owner.dispose);
        const api = owner.handle.getExposes();
        expect(api.read()).toBe(enabled ? 73 : 0);
        if (enabled) expect(api.answer).toBe(73);
        else expect(Object.hasOwn(api, 'answer')).toBe(false);
        expect(owner.host.textContent).toContain(enabled ? '73' : '0');
        const retained = api.read;
        await owner.dispose();
        expect(() => retained()).toThrow(/dispos|alive|terminal/i);
      }
    );
  });
