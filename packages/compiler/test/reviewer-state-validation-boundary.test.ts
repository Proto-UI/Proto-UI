// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'fixtures/reviewer-state-validation.proto.ts'
  ),
  'utf8'
);
it('admits the same source through portable validation and the public GPUI emitter', () => {
  const result = compilePrototype(source, { profile: 'gpui-source-v1' });
  expect(result.ok, JSON.stringify(result.ok ? {} : result.diagnostics)).toBe(true);
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('catches invalid State values and preserves the owner for later valid operations', async () => {
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      expect(api.attempt()).toBe(true);
      expect(api.read()).toBe(0);
      expect(() => api.invalid()).toThrow();
      expect(api.read()).toBe(0);
      expect(api.valid()).toBe(1);
      expect(api.read()).toBe(1);
    });
  });
