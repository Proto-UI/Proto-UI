import { describe, expect, it } from 'vitest';
import { assertNoRemovedLegacyNativeProtocol } from '../src/legacy-native-admission';
import type { OutputArtifact } from '../src/artifact-output';

function artifacts(source: string): OutputArtifact[] {
  return [
    { path: 'Component.js', kind: 'source', contents: source },
    {
      path: '.proto-ui/interaction/native-v1.ts',
      kind: 'source',
      contents: `export interface NativeInteraction { asTransition(): object }
      export declare function createNativeInteraction(): NativeInteraction;`,
    },
  ];
}
const imported = `import {createNativeInteraction as make} from './.proto-ui/interaction/native-v1';`;
describe('legacy native protocol declaration admission', () => {
  it.each([
    'make().asTransition();',
    `make()['asTransition']();`,
    'const native = make(); const install = native.asTransition; install();',
    'const native = make(); const {asTransition: install} = native; install();',
  ])('rejects the removed actual API through %s', (use) => {
    expect(() => assertNoRemovedLegacyNativeProtocol(artifacts(imported + use))).toThrow(
      /requires recompiling its authored source/
    );
  });
  it('allows an ordinary same-named method, including when the old helper is imported', () => {
    expect(() =>
      assertNoRemovedLegacyNativeProtocol(
        artifacts(
          imported +
            `
      make(); const own = {asTransition() {return 42;}}; own.asTransition();
      const {asTransition: install} = own; install();`
        )
      )
    ).not.toThrow();
  });
  it('does not reject an unused historical declaration merely present in the support file', () => {
    expect(() =>
      assertNoRemovedLegacyNativeProtocol(artifacts(imported + 'make();'))
    ).not.toThrow();
  });
});
