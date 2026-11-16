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
    'fixtures/projected-record-mutation.proto.ts'
  ),
  'utf8'
);
it('admits public record mutation and return in the GPUI profile', () => {
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
    it('guards a newly assigned callable when an already-projected record crosses the public boundary again', async () => {
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      const before = api.getRecord();
      const after = api.replaceRecord(before);
      expect(after).toBe(before);
      const action = after.action;
      expect(action()).toBe(9);
      await owner.dispose();
      expect(() => action()).toThrow(/dispos|alive|terminal/i);
    });
  });
