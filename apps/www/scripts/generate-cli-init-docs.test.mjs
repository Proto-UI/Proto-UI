import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { scanGenerated, directoryText, generateCliInitDocs } from './generate-cli-init-docs.mjs';

test('records real empty directories and exact UTF-8 bytes in stable order', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'init-scan-test-'));
  try {
    await mkdir(path.join(root, 'empty'));
    await writeFile(path.join(root, 'z.txt'), '中文\r\n');
    await writeFile(path.join(root, 'a.json'), '{}\n');
    const entries = await scanGenerated(root);
    assert.deepEqual(
      entries.map((e) => e.path),
      ['a.json', 'empty', 'z.txt']
    );
    assert.equal(entries[2].content, '中文\r\n');
    assert.equal(entries[2].bytes, Buffer.byteLength('中文\r\n'));
    assert.equal(entries[2].sha256, createHash('sha256').update('中文\r\n').digest('hex'));
    assert.equal(directoryText(entries), 'your-project/\n├── a.json\n├── empty/\n└── z.txt\n');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('rejects symlinks instead of extracting outside the generated project', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'init-link-test-'));
  try {
    await symlink(path.join(root, '..'), path.join(root, 'escape'));
    await assert.rejects(scanGenerated(root), /Unsupported generated entry/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('rejects non-text output rather than silently changing file bytes', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'init-binary-test-'));
  try {
    await writeFile(path.join(root, 'binary'), Buffer.from([0xff]));
    await assert.rejects(scanGenerated(root), /Non-UTF8/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test('real built CLI init is deterministic, has no invented input files and records complete contents', async () => {
  const first = await generateCliInitDocs();
  const second = await generateCliInitDocs();
  assert.deepEqual(second, first);
  assert.deepEqual(first.inputs, []);
  assert.equal(
    first.entries.some((e) => e.path === 'package.json'),
    false
  );
  for (const dir of ['proto-ui/adapters', 'proto-ui/prototypes', 'proto-ui/components']) {
    assert.equal(first.entries.find((e) => e.path === dir)?.kind, 'directory');
    assert.equal(
      first.entries.some((e) => e.path.startsWith(`${dir}/`)),
      false
    );
  }
  const files = first.entries.filter((e) => e.kind === 'file');
  assert.equal(files.length, 4);
  for (const file of files) {
    assert.equal(file.bytes, Buffer.byteLength(file.content));
    assert.equal(file.sha256, createHash('sha256').update(file.content).digest('hex'));
  }
  const pkg = JSON.parse(
    await readFile(new URL('../../../packages/cli/package.json', import.meta.url), 'utf8')
  );
  assert.equal(first.cli.version, pkg.version);
  assert.match(first.cli.sourceTreeHash, /^[0-9a-f]{64}$/);
  assert.match(first.cli.buildTreeHash, /^[0-9a-f]{64}$/);
});

test('failed real build deletes stale documentation and never executes init', async () => {
  const fixture = await mkdtemp(path.join(tmpdir(), 'init-build-failure-'));
  try {
    const scripts = path.join(fixture, 'apps/www/scripts');
    const generated = path.join(fixture, 'apps/www/src/generated');
    await mkdir(scripts, { recursive: true });
    await mkdir(generated, { recursive: true });
    await mkdir(path.join(fixture, 'scripts/build'), { recursive: true });
    await writeFile(
      path.join(scripts, 'generate-cli-init-docs.mjs'),
      await readFile(new URL('./generate-cli-init-docs.mjs', import.meta.url))
    );
    await writeFile(path.join(fixture, 'scripts/build/public-packages.mjs'), 'process.exit(17);');
    const output = path.join(generated, 'cli-init.generated.json');
    await writeFile(output, '{"stale":true}');
    const result = spawnSync(process.execPath, [path.join(scripts, 'generate-cli-init-docs.mjs')], {
      encoding: 'utf8',
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /CLI build failed: 17/);
    await assert.rejects(readFile(output), { code: 'ENOENT' });
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
