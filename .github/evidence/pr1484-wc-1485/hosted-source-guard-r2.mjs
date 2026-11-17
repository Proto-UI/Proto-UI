import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, lstat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

// A fresh carrier guard; it never changes historical guards, test assertions or environment values.
const [manifestArg, rootArg, evidenceArg, stage] = process.argv.slice(2);
if (!manifestArg || !rootArg || !evidenceArg || !['before', 'after'].includes(stage)) {
  throw new Error('Usage: node hosted-source-guard-r2.mjs <manifest> <root> <evidence> <before|after>');
}
const root = path.resolve(rootArg);
const evidence = path.resolve(evidenceArg);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile(path.resolve(manifestArg));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const manifestSha256 = digest(manifestBytes);
const sourceSha = execFileSync('git', ['--no-optional-locks', '-C', root, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
assert.match(process.env.GITHUB_SHA ?? '', /^[0-9a-f]{40}$/);
assert.equal(sourceSha, process.env.GITHUB_SHA, 'Checked-out source does not match the actual Actions head');
assert.ok(manifest.files.length > 0);
assert.equal(new Set(manifest.files.map(file => file.path)).size, manifest.files.length);
const files = [];
for (const expected of manifest.files) {
  assert.ok(!path.isAbsolute(expected.path) && !expected.path.split('/').includes('..'));
  const file = path.join(root, expected.path);
  assert.equal((await lstat(file)).isFile(), true, 'Expected regular carrier source: ' + expected.path);
  const bytes = await readFile(file);
  const sha256 = digest(bytes);
  assert.equal(bytes.length, expected.bytes, 'Source length changed: ' + expected.path);
  assert.equal(sha256, expected.sha256, 'Source hash changed: ' + expected.path);
  files.push({ path: expected.path, bytes: bytes.length, sha256 });
}
if (stage === 'after') {
  const before = JSON.parse(await readFile(path.join(evidence, 'guard-before.json'), 'utf8'));
  assert.equal(before.manifestSha256, manifestSha256, 'Guard manifest changed during execution');
  assert.equal(before.sourceSha, sourceSha, 'Carrier head changed during execution');
  assert.deepEqual(files, before.files, 'Admitted source changed during execution');
}
const environment = Object.fromEntries([
  'CI', 'GITHUB_ACTIONS', 'VITEST', 'PROTO_UI_RUNTIME_PHASE', 'PROTO_UI_RUNTIME_SHARD',
  'PROTO_UI_RUNTIME_SLOT', 'PROTO_UI_BROWSER_BASE_URL', 'CHROME_PATH',
].map(key => [key, process.env[key] ?? null]));
const result = { kind: 'actual-hosted-source-guard', stage, sourceSha, manifestSha256,
  node: process.version, execArgv: process.execArgv, environment, files };
await mkdir(evidence, { recursive: true, mode: 0o700 });
await writeFile(path.join(evidence, 'guard-' + stage + '.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(JSON.stringify({ stage, sourceSha, manifestSha256, files: files.length, environment }));
