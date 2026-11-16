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
    'fixtures/reviewer-public-roundtrip.proto.ts'
  ),
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
    });
  });
