import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { register } from 'tsx/esm/api';
import {
  currentComponentProfiles,
  localSourceSnapshot,
  programSourceBinding,
  verifyProgramSourceBinding,
} from './current-api.mjs';

test('inventory uses the compiler-owned component targets and retains retired target identities as unimplemented', async () => {
  const unregister = register();
  try {
    const api = await import('../../packages/compiler/src/index.ts');
    const profiles = currentComponentProfiles(api);
    assert.deepEqual(
      profiles
        .filter((row) => row.implemented)
        .map((row) => row.id)
        .sort(),
      [...api.COMPONENT_TARGETS].sort()
    );
    assert.ok(!profiles.some((row) => row.id === 'kernel' || row.id === 'ir'));
    for (const id of [
      'react-runtime-v1',
      'vue-source-v1',
      'vue2-source-v1',
      'web-component-source-v1',
      'gpui-source-v1',
    ]) {
      const row = profiles.find((profile) => profile.id === id);
      assert.equal(row.implemented, false);
      assert.equal(row.declarationDiagnostics[0].code, 'INVENTORY_TARGET_UNIMPLEMENTED');
    }
  } finally {
    unregister();
  }
});

test('source inventory follows actual local TypeScript resolution without running author modules and detects subsequent byte changes', async () => {
  const unregister = register();
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-current-api-'));
  try {
    const { createCompiler } = await import('../../packages/compiler/src/index.ts');
    const root = path.join(directory, 'source');
    mkdirSync(root);
    const entry = path.join(root, 'entry.ts'),
      helper = path.join(root, 'helper.ts');
    writeFileSync(entry, "import {value} from './helper'; export const result = value;\n");
    writeFileSync(
      helper,
      "throw new Error('authored modules must not execute'); export const value = 3;\n"
    );
    const compiler = createCompiler({ rootDir: root });
    const snapshot = localSourceSnapshot(compiler, entry);
    assert.equal(snapshot.error, null);
    assert.deepEqual(Object.keys(snapshot.snapshot.files).sort(), ['entry.ts', 'helper.ts']);
    const bound = programSourceBinding(compiler.session.ensureFiles([entry]));
    verifyProgramSourceBinding(bound);
    writeFileSync(helper, 'export const value = 4;\n');
    assert.throws(() => verifyProgramSourceBinding(bound), /input changed/);
    const fresh = createCompiler({ rootDir: root });
    assert.match(localSourceSnapshot(fresh, entry).snapshot.files['helper.ts'], /value = 4/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    unregister();
  }
});

test('an authored relative import outside the declared root remains an explicit unresolved closure', async () => {
  const unregister = register();
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-current-api-outside-'));
  try {
    const { createCompiler } = await import('../../packages/compiler/src/index.ts');
    const root = path.join(directory, 'source');
    mkdirSync(root);
    const entry = path.join(root, 'entry.ts');
    writeFileSync(entry, "import {value} from '../foreign'; export const result = value;\n");
    writeFileSync(path.join(directory, 'foreign.ts'), 'export const value = 5;\n');
    const snapshot = localSourceSnapshot(createCompiler({ rootDir: root }), entry);
    assert.match(snapshot.error, /escapes/);
    assert.deepEqual(Object.keys(snapshot.snapshot.files), ['entry.ts']);
  } finally {
    rmSync(directory, { recursive: true, force: true });
    unregister();
  }
});
