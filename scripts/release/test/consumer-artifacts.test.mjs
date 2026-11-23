import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseConsumerArtifactArgs, reserveConsumerArtifacts } from '../consumer-artifacts.mjs';

function fixture(t) {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-consumer-artifacts-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const rootDir = path.join(directory, 'source');
  mkdirSync(rootDir);
  return { directory, rootDir, prefix: 'consumer-' };
}

test('both consumer commands expose retention without building or installing', () => {
  for (const consumer of ['react', 'cli']) {
    const script = fileURLToPath(new URL(`../consumer-smoke-${consumer}.mjs`, import.meta.url));
    const output = execFileSync(process.execPath, [script, '--help'], {
      encoding: 'utf8',
      timeout: 10000,
    });
    assert.match(output, /\[--keep\] \[--work-dir <path>\]/);
  }
});

test('artifact options accept package-manager separators and reject missing or duplicate destinations', () => {
  const rootDir = path.resolve('project', 'source');
  assert.deepEqual(
    parseConsumerArtifactArgs(['--', '--keep', '--work-dir', '../evidence'], rootDir),
    {
      help: false,
      keep: true,
      workDir: path.resolve(rootDir, '../evidence'),
    }
  );
  for (const argv of [
    ['--work-dir'],
    ['--work-dir', '--keep'],
    ['--work-dir', 'one', '--work-dir', 'two'],
    ['--skip-tests'],
  ])
    assert.throws(() => parseConsumerArtifactArgs(argv, rootDir));
});

test('fresh explicit and temporary destinations are owned and outside the checkout', (t) => {
  const f = fixture(t);
  const explicit = path.join(f.directory, 'new parent', 'react');
  assert.equal(reserveConsumerArtifacts({ workDir: explicit }, f), explicit);
  writeFileSync(path.join(explicit, 'pack-manifest.json'), '{"actual":"kept"}');
  const temporaryRoot = path.join(f.directory, 'temporary');
  const first = reserveConsumerArtifacts({}, { ...f, temporaryRoot });
  const second = reserveConsumerArtifacts({}, { ...f, temporaryRoot });
  assert.notEqual(first, second);
  assert.equal(path.dirname(first), temporaryRoot);
  assert.equal(
    readFileSync(path.join(explicit, 'pack-manifest.json'), 'utf8'),
    '{"actual":"kept"}'
  );
});

test('an existing consumer, even an empty directory, is never deleted or replaced', (t) => {
  const f = fixture(t);
  const output = path.join(f.directory, 'existing');
  mkdirSync(output);
  assert.throws(() => reserveConsumerArtifacts({ workDir: output }, f), /EEXIST/);
  writeFileSync(path.join(output, 'native-receipt.json'), 'original receipt bytes');
  assert.throws(() => reserveConsumerArtifacts({ workDir: output }, f), /EEXIST/);
  assert.equal(
    readFileSync(path.join(output, 'native-receipt.json'), 'utf8'),
    'original receipt bytes'
  );
});

test('checkout paths and outside aliases into ignored checkout paths are rejected before creation', (t) => {
  const f = fixture(t);
  const ignored = path.join(f.rootDir, 'ignored-build');
  mkdirSync(ignored);
  const alias = path.join(f.directory, 'outside-alias');
  symlinkSync(ignored, alias, process.platform === 'win32' ? 'junction' : 'dir');
  for (const workDir of [f.rootDir, path.join(ignored, 'new'), path.join(alias, 'new', 'child')])
    assert.throws(() => reserveConsumerArtifacts({ workDir }, f), /outside the source/);
  assert.throws(
    () => reserveConsumerArtifacts({}, { ...f, temporaryRoot: alias }),
    /outside the source/
  );
  assert.deepEqual(readdirSync(ignored), []);
  const sibling = path.join(f.directory, 'source-other', 'consumer');
  assert.equal(reserveConsumerArtifacts({ workDir: sibling }, f), sibling);
  assert.ok(existsSync(sibling));
});
