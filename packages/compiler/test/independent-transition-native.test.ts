// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mountNativeOwner, nativeOwnerProfiles } from './native-owner-consumer';
import { transitionJourneys, type TransitionOracleAPI } from './independent-transition-oracle';

const fileName = 'packages/compiler/test/fixtures/independent-transition-owner.proto.ts';
const source = readFileSync(fileName, 'utf8');
const files = Object.fromEntries(
  ['as-transition.proto.ts', 'machine.ts', 'types.ts'].map((name) => {
    const file = `packages/prototypes/base/src/transition/${name}`;
    return [file, readFileSync(file, 'utf8')];
  })
);
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

for (const profile of nativeOwnerProfiles)
  describe(`independent definition oracle: ${profile}`, () => {
    for (const journey of transitionJourneys)
      it(
        journey.name,
        async () => {
          // Vue's renderer otherwise starts a process-wide 3-second devtools
          // discovery timer. Install an inert devtools sink so the clock below
          // measures resources owned by the compiled component, not discovery.
          vi.stubGlobal('__VUE_DEVTOOLS_GLOBAL_HOOK__', { emit() {} });
          vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
          const owner = await mountNativeOwner(source, profile, { compile: { fileName, files } });
          try {
            expect(owner.compiled.ir.sourceFiles.map((file) => file.file)).toEqual(
              [fileName, ...Object.keys(files)].sort()
            );
            await journey.run({
              api: owner.handle.getExposes() as TransitionOracleAPI,
              act: owner.act,
              advance: async (milliseconds) => {
                await owner.act(() => vi.advanceTimersByTime(milliseconds));
              },
              dispose: owner.dispose,
            });
          } finally {
            await owner.dispose();
          }
          expect(vi.getTimerCount()).toBe(0);
        },
        30_000
      );
  });
