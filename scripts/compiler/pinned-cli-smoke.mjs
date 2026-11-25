/** Plain-Node CLI publication checks for the current AST package. */
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNativeConsumer } from './native-consumer-smoke.mjs';

assert.ok(
  process.env.NATIVE_CONSUMER_COMPILER,
  'Select a current installed pinned compiler index.js with NATIVE_CONSUMER_COMPILER'
);
const entry = path.resolve(process.env.NATIVE_CONSUMER_COMPILER);
const artifact = path.dirname(entry);
const cli = path.join(artifact, 'cli.js');
const root = fileURLToPath(new URL('../../', import.meta.url));
const work = mkdtempSync(path.join(tmpdir(), 'proto-pinned-cli-ast-'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const metadata = JSON.parse(readFileSync(path.join(artifact, 'compiler-build.json'), 'utf8'));
const summary = {
  schema: 'proto-ui.pinned-cli-ast-consumer.v1',
  compilerBuild: metadata,
  evidence: work,
  commands: [],
  checks: [],
  ok: false,
  missing: [
    'watch/diff and last-success retention',
    'source-map ownership',
    'atomic multi-artifact publication',
  ],
};
const save = () =>
  writeFileSync(path.join(work, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
function run(name, args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
    encoding: 'utf8',
    timeout: 60_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  writeFileSync(path.join(work, name + '.stdout.log'), result.stdout ?? '');
  writeFileSync(path.join(work, name + '.stderr.log'), result.stderr ?? '');
  summary.commands.push({
    name,
    args,
    status: result.status,
    signal: result.signal,
    error: result.error?.message ?? null,
  });
  save();
  assert.equal(result.error, undefined, name);
  assert.equal(result.status, expected, name + ': ' + result.stderr + result.stdout);
  return result;
}
function competing(name, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd: root,
      env: { ...process.env, NODE_OPTIONS: '', NODE_PATH: '' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '',
      stderr = '';
    child.stdout.on('data', (data) => {
      stdout += data;
    });
    child.stderr.on('data', (data) => {
      stderr += data;
    });
    const timeout = setTimeout(() => child.kill('SIGTERM'), 60_000);
    child.once('error', reject);
    child.once('close', (status, signal) => {
      clearTimeout(timeout);
      writeFileSync(path.join(work, name + '.stdout.log'), stdout);
      writeFileSync(path.join(work, name + '.stderr.log'), stderr);
      const receipt = { name, args, status, signal, stdout, stderr };
      summary.commands.push(receipt);
      save();
      resolve(receipt);
    });
  });
}

try {
  assert.equal(metadata.schema, 'proto-ui.compiler-package.v3');
  for (const file of metadata.files) {
    const bytes = readFileSync(path.join(artifact, file.path));
    assert.equal(bytes.length, file.bytes);
    assert.equal(hash(bytes), file.sha256, file.path);
  }
  assert.deepEqual(JSON.parse(run('build-info', ['--build-info']).stdout), metadata);
  const info = JSON.parse(run('info', ['info', '--json']).stdout);
  assert.deepEqual(info.targets, ['react', 'gpui', 'kernel', 'ir']);
  const source = path.join(work, 'entry.proto.ts');
  writeFileSync(
    source,
    "import {definePrototype} from '@proto.ui/core'; export default definePrototype({name:'editable-counter',setup(){return r=>r.el('section','first');}});\n"
  );
  const flags = [
    'compile',
    source,
    '--root',
    root,
    '--target',
    'react',
    '--component',
    'EditableCounter',
    '--json',
  ];
  const output = path.join(work, 'generated');
  const result = JSON.parse(run('fresh', [...flags, '--out', output]).stdout);
  assert.equal(result.ok, true);
  const target = path.join(output, 'EditableCounter.tsx');
  const original = readFileSync(target);
  assert.ok(original.length > 0);
  run('collision', [...flags, '--out', output], 2);
  assert.deepEqual(readFileSync(target), original);
  const edited = Buffer.concat([Buffer.from('// ordinary consumer edit\n'), original]);
  writeFileSync(target, edited);
  run('edited-collision', [...flags, '--out', output], 2);
  assert.deepEqual(readFileSync(target), edited);
  run('explicit-overwrite', [...flags, '--out', output, '--overwrite']);
  assert.deepEqual(readFileSync(target), original);
  summary.checks.push(
    'Plain-Node metadata/compile, default collision protection, retained consumer edit and explicit overwrite'
  );

  const foreign = path.join(work, 'foreign');
  mkdirSync(foreign);
  writeFileSync(path.join(foreign, 'consumer.txt'), 'keep');
  const linked = path.join(work, 'linked-output');
  symlinkSync(foreign, linked, 'dir');
  run('symlink-directory', [...flags, '--out', linked], 1);
  assert.deepEqual(readdirSync(foreign), ['consumer.txt']);
  const fileOutput = path.join(work, 'file-link');
  mkdirSync(fileOutput);
  symlinkSync(path.join(foreign, 'consumer.txt'), path.join(fileOutput, 'EditableCounter.tsx'));
  run('symlink-file-overwrite', [...flags, '--out', fileOutput, '--overwrite'], 1);
  assert.equal(readFileSync(path.join(foreign, 'consumer.txt'), 'utf8'), 'keep');
  summary.checks.push('Directory/file symlinks cannot redirect output into consumer-owned paths');

  const contested = path.join(work, 'contested');
  const attempts = await Promise.all([
    competing('race-a', [...flags, '--out', contested]),
    competing('race-b', [...flags, '--out', contested]),
  ]);
  assert.equal(
    attempts.filter((item) => item.status === 0).length,
    1,
    'Exactly one non-overwrite writer may publish the artifact'
  );
  assert.ok(
    attempts.every((item) => [0, 1, 2].includes(item.status)),
    'Contending writer must report a controlled refusal'
  );
  assert.match(
    attempts.find((item) => item.status !== 0).stderr,
    /exists|lock|concurrent|another writer/i
  );
  assert.ok(attempts.every((item) => item.signal === null));
  assert.deepEqual(readFileSync(path.join(contested, 'EditableCounter.tsx')), original);
  summary.checks.push('Two real concurrent CLI processes cannot both publish the same output');
  for (const command of ['watch', 'diff'])
    run('unsupported-' + command, [command, source, '--root', root, '--json'], 2);
  summary.nativeConsumer = await runNativeConsumer({ compilerEntry: entry, sourceRoot: root });
  assert.equal(summary.nativeConsumer.ok, true, summary.nativeConsumer.error);
  summary.checks.push(
    'The same pinned API emits an independently mounted and editable ordinary React component'
  );
  summary.ok = true;
} catch (error) {
  summary.error = error instanceof Error ? error.stack : String(error);
  process.exitCode = 1;
} finally {
  save();
  console.log(JSON.stringify(summary, null, 2));
}
