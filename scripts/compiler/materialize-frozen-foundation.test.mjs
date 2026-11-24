import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  materializeContentEntries,
  materializeFrozenFoundation,
} from './materialize-frozen-foundation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const script = fileURLToPath(new URL('./materialize-frozen-foundation.mjs', import.meta.url));

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'pui-foundation-materialization-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const packet = join(root, 'packet');
  const output = join(root, 'output');
  await mkdir(join(packet, 'objects/sha256'), { recursive: true });
  const entries = [];
  async function input(path, text, mode = 0o644) {
    const bytes = Buffer.from(text);
    const entry = { path, size: bytes.length, sha256: hash(bytes), mode };
    await writeFile(join(packet, 'objects/sha256', entry.sha256), bytes);
    entries.push(entry);
    return entry;
  }
  // Entirely new synthetic sources; these cannot authenticate as the old packet.
  await input('packages/compiler/src/ir.ts', 'export const IR_VERSION = 10;\n');
  await input(
    'scripts/throw.mjs',
    'throw new Error("materialization must not execute source");\n',
    0o755
  );
  await input('spec/input.yaml', 'status: draft\n');
  return { root, packet, output, entries, input };
}

async function inventory(root, prefix = '') {
  const result = [];
  for (const name of (await readdir(join(root, prefix))).sort()) {
    const path = join(prefix, name);
    const stat = await lstat(join(root, path));
    if (stat.isDirectory()) result.push(...(await inventory(root, path)));
    else
      result.push({
        path,
        mode: stat.mode & 0o777,
        sha256: hash(await readFile(join(root, path))),
      });
  }
  return result;
}

test('reconstructs every captured byte and mode without executing or altering its source', async (t) => {
  const f = await fixture(t);
  const before = await inventory(f.packet);
  const result = await materializeContentEntries(f.packet, f.output, f.entries);
  assert.equal(result.files, f.entries.length);
  assert.equal(
    result.bytes,
    f.entries.reduce((sum, row) => sum + row.size, 0)
  );
  assert.deepEqual(
    await inventory(f.output),
    f.entries.map(({ path, mode, sha256 }) => ({ path, mode, sha256 }))
  );
  assert.deepEqual(await inventory(f.packet), before);
  assert.equal((await lstat(f.output)).mode & 0o777, 0o700);
});

test('existing output remains byte-identical and is never used as a partial destination', async (t) => {
  const f = await fixture(t);
  await mkdir(f.output);
  await writeFile(join(f.output, 'user-file'), 'preserve user work\n');
  const before = await inventory(f.output);
  await assert.rejects(materializeContentEntries(f.packet, f.output, f.entries), {
    code: 'OUTPUT_EXISTS',
  });
  assert.deepEqual(await inventory(f.output), before);
  await assert.rejects(materializeContentEntries(f.packet, join(f.packet, 'new'), f.entries), {
    code: 'OVERLAPPING_OUTPUT',
  });
  await assert.rejects(materializeContentEntries(f.packet, f.root, f.entries), {
    code: 'OVERLAPPING_OUTPUT',
  });
});

test('all object hashes and declared sizes are checked before creating any output', async (t) => {
  const f = await fixture(t);
  const entry = f.entries.at(-1);
  await writeFile(join(f.packet, 'objects/sha256', entry.sha256), 'status: wrong\n');
  await assert.rejects(materializeContentEntries(f.packet, f.output, f.entries), {
    code: 'CONTENT_IDENTITY',
  });
  assert.equal(await lstat(f.output).catch(() => null), null);
  const size = await fixture(t);
  size.entries.at(-1).size++;
  await assert.rejects(materializeContentEntries(size.packet, size.output, size.entries), {
    code: 'CONTENT_SIZE',
  });
  assert.equal(await lstat(size.output).catch(() => null), null);
});

test('unsafe names, duplicate inputs, file-directory collisions and mode escalation are refused', async (t) => {
  for (const path of [
    '../escape',
    '/absolute',
    'a/../escape',
    'a\\escape',
    'C:escape',
    '.git/config',
    'a//b',
    'a/./b',
    'a\0b',
  ]) {
    const f = await fixture(t);
    f.entries[0].path = path;
    await assert.rejects(materializeContentEntries(f.packet, f.output, f.entries), {
      code: 'UNSAFE_INPUT_PATH',
    });
    assert.equal(await lstat(f.output).catch(() => null), null);
  }
  const duplicate = await fixture(t);
  duplicate.entries.push(duplicate.entries[0]);
  await assert.rejects(
    materializeContentEntries(duplicate.packet, duplicate.output, duplicate.entries),
    { code: 'DUPLICATE_INPUT_PATH' }
  );
  const collision = await fixture(t);
  collision.entries[1].path = 'packages/compiler';
  await assert.rejects(
    materializeContentEntries(collision.packet, collision.output, collision.entries),
    { code: 'INPUT_DIRECTORY_COLLISION' }
  );
  const mode = await fixture(t);
  mode.entries[0].mode = 0o4644;
  await assert.rejects(materializeContentEntries(mode.packet, mode.output, mode.entries), {
    code: 'INVALID_INPUT_MODE',
  });
});

test('input objects and output parents cannot redirect reconstruction through symlinks', async (t) => {
  const f = await fixture(t);
  const entry = f.entries[0];
  const object = join(f.packet, 'objects/sha256', entry.sha256);
  const outside = join(f.root, 'outside');
  await writeFile(outside, await readFile(object));
  await rm(object);
  await symlink(outside, object);
  await assert.rejects(materializeContentEntries(f.packet, f.output, f.entries), {
    code: 'UNSAFE_CONTENT_OBJECT',
  });
  const parent = await fixture(t);
  await mkdir(join(parent.root, 'real'));
  await symlink(join(parent.root, 'real'), join(parent.root, 'redirect'));
  await assert.rejects(
    materializeContentEntries(parent.packet, join(parent.root, 'redirect/new'), parent.entries),
    { code: 'UNSAFE_DIRECTORY' }
  );
  assert.deepEqual(await readdir(join(parent.root, 'real')), []);
});

test('public historical entry refuses synthetic packets and hides supplied private locators', async (t) => {
  const f = await fixture(t);
  await writeFile(join(f.packet, 'closure-index-v1.json'), '{}\n');
  const result = await materializeFrozenFoundation(f.packet, f.output);
  assert.equal(result.passed, false);
  assert.equal(result.failure, 'INDEX_ANCHOR');
  assert.equal(result.originalCompilerReplay, false);
  assert.equal(result.originalAuthorRightsCertified, false);
  assert.equal(result.installedToolchainMaterialized, false);
  assert.equal(await lstat(f.output).catch(() => null), null);
  const cli = spawnSync(process.execPath, [script, '--packet', f.packet, '--out', f.output], {
    encoding: 'utf8',
  });
  assert.equal(cli.status, 1);
  assert.equal(JSON.parse(cli.stdout).failure, 'INDEX_ANCHOR');
  assert.equal(cli.stdout.includes(f.root), false);
  assert.equal(cli.stderr, '');
});
