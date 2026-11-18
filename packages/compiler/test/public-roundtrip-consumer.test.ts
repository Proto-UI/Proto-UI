// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { compilePrototype } from '../src/compile';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/public-roundtrip.proto.ts'),
  'utf8'
);
it('admits callable-bearing public round trips in the GPUI profile', () => {
  const compiled = compilePrototype(source, { profile: 'gpui-source-v1' });
  expect(compiled.ok, JSON.stringify(compiled.ok ? {} : compiled.diagnostics)).toBe(true);
});

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('preserves previously projected record and callable identities across a public round trip', async () => {
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      const record = api.getRecord();
      expect(api.echoRecord(record)).toBe(record);
      expect(api.echoRecord(record).action).toBe(record.action);
      const callable = api.getFunction();
      expect(api.echoFunction(callable)).toBe(callable);
      expect(callable()).toBe(7);
      await owner.dispose();
      expect(() => callable()).toThrow(/dispos|alive|terminal/i);
    });
    it('retains both owner boundaries when another component returns the public function', async () => {
      const first = await mountNativeOwner(source, profile);
      const second = await mountNativeOwner(source, profile);
      cleanup.push(first.dispose, second.dispose);
      const original = first.handle.getExposes().getFunction();
      const forwarded = second.handle.getExposes().echoFunction(original);
      expect(forwarded).not.toBe(original);
      expect(second.handle.getExposes().echoFunction(forwarded)).toBe(forwarded);
      expect(forwarded()).toBe(7);
      await second.dispose();
      expect(() => forwarded()).toThrow(/dispos|alive|terminal/i);
      expect(original()).toBe(7);
      await first.dispose();
      expect(() => original()).toThrow(/dispos|alive|terminal/i);
    });
  });
