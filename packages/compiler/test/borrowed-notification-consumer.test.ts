// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';

const source = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    'fixtures/borrowed-notification.proto.ts'
  ),
  'utf8'
);
const forwardSource = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures/forward-state-watch.proto.ts'),
  'utf8'
);
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const dispose of cleanup.splice(0).reverse()) await dispose();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(profile, () => {
    it('keeps recorded borrowed-State notifications after a sibling throws', async () => {
      const owner = await mountNativeOwner(source, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      let failure: unknown = 'missing';
      try {
        api.write(1);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBe(0);
      expect(api.trace()).toBe('a1,b1,a2,b2,');
      api.write(3);
      expect(api.trace()).toBe('a1,b1,a2,b2,a3,b3,');
    });
    it('captures a later disposer and cancels its recorded registration without eager installation', async () => {
      const owner = await mountNativeOwner(forwardSource, profile);
      cleanup.push(owner.dispose);
      const api = owner.handle.getExposes();
      let failure: unknown = 'missing';
      try {
        api.write(1);
      } catch (error) {
        failure = error;
      }
      expect(failure).toBe(0);
      expect(api.trace()).toBe('a1,b1,a2,b2,');
      api.write(3);
      expect(api.trace()).toBe('a1,b1,a2,b2,a3,');
      api.write(4);
      expect(api.trace()).toBe('a1,b1,a2,b2,a3,a4,');
    });
  });
