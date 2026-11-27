import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  COMPILER_STATUS,
  CompilerUnavailableError,
  requireCompilerImplementation,
} from '../src/index.ts';

const cli = fileURLToPath(new URL('../src/cli-entry.mjs', import.meta.url));

test('all five required targets remain visibly unimplemented', () => {
  assert.equal(COMPILER_STATUS.legacyImplementation, 'retired');
  assert.equal(COMPILER_STATUS.implementation, 'not-implemented');
  assert.deepEqual(Object.keys(COMPILER_STATUS.targets), [
    'react',
    'gpui',
    'vue2',
    'vue3',
    'web-components',
  ]);
  assert.ok(Object.values(COMPILER_STATUS.targets).every((status) => status === 'not-implemented'));
  assert.ok(Object.isFrozen(COMPILER_STATUS));
  assert.ok(Object.isFrozen(COMPILER_STATUS.targets));
});

test('the integration boundary raises the explicit unavailable diagnostic', () => {
  assert.throws(requireCompilerImplementation, (error) => {
    assert.ok(error instanceof CompilerUnavailableError);
    assert.equal(error.code, 'PUI_COMPILER_NOT_IMPLEMENTED');
    return true;
  });
});

test('the CLI exposes status without claiming compilation', () => {
  const result = spawnSync(process.execPath, [cli, '--status'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), COMPILER_STATUS);
});

test('compilation invocations fail before input loading or output publication', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'proto-compiler-retired-'));
  try {
    const source = path.join(directory, 'missing.proto.ts');
    const output = path.join(directory, 'generated');
    const result = spawnSync(process.execPath, [cli, 'compile', source, '--out', output], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /\[PUI_COMPILER_NOT_IMPLEMENTED\]/);
    assert.doesNotMatch(result.stderr, /ENOENT/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
