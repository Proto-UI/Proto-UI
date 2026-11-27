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

test('availability identifies the two partial native targets and the remaining targets', () => {
  assert.equal(COMPILER_STATUS.legacyImplementation, 'retired');
  assert.deepEqual(COMPILER_STATUS.targets, {
    react: 'partial',
    gpui: 'partial',
    vue2: 'not-implemented',
    vue3: 'not-implemented',
    'web-components': 'not-implemented',
  });
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

test('an unavailable source never publishes a component', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'proto-compiler-retired-'));
  try {
    const source = path.join(directory, 'missing.proto.ts');
    const output = path.join(directory, 'generated');
    const result = spawnSync(
      process.execPath,
      [cli, 'compile', source, '--target', 'react', '--out', output],
      {
        cwd: directory,
        encoding: 'utf8',
      }
    );
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /missing\.proto\.ts/);
    assert.equal(existsSync(output), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
