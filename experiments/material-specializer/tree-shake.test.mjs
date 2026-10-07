import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const implementation = 'packages/modules/feedback/src/material/owned-slot.ts';
for (const entry of [
  'packages/runtime/src/index.ts',
  'packages/adapters/react/src/index.ts',
  'packages/adapters/vue/src/index.ts',
  'packages/adapters/web-component/src/index.ts',
]) {
  test(`material semantic implementation is opt-in: ${entry}`, async () => {
    const result = await build({
      entryPoints: [entry],
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'browser',
      tsconfig: 'tsconfig.json',
      external: ['react', 'react-dom', 'react-dom/*', 'vue', '@floating-ui/dom', 'node:*'],
      logLevel: 'silent',
    });
    const included = Object.hasOwn(result.metafile.inputs, implementation);
    assert.equal(
      included,
      entry.includes('web-component'),
      'plain Runtime/React/Vue must not statically include the material semantic implementation'
    );
  });
}
