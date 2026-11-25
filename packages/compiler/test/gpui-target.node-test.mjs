import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { emitGpui } from '@proto.ui/compiler/targets/gpui';
import { controlledSelection, readonlyBadge } from './fixtures/backend-programs.ts';

const sdkRepository = 'https://github.com/zed-industries/zed';
const sdkRevision = '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8';
const sdkSource = `git+${sdkRepository}?rev=${sdkRevision}#${sdkRevision}`;
const consumerSource = new URL('./consumers/gpui/', import.meta.url);
const support = fileURLToPath(new URL('../support/gpui/', import.meta.url));
const seedLock = new URL('../../../native/gpui/Cargo.lock', import.meta.url);

function manifest(packageName) {
  return `[package]
name = "${packageName}"
version = "0.1.0"
edition = "2021"
publish = false

[lib]
name = "generated_gpui_consumer"

[workspace]
resolver = "2"

[workspace.dependencies]
gpui = { git = "${sdkRepository}", rev = "${sdkRevision}", default-features = false }

[dependencies]
gpui.workspace = true
proto-ui-gpui-support = { path = ${JSON.stringify(support)} }

[dev-dependencies]
gpui = { workspace = true, features = ["test-support"] }
`;
}

// Cargo writes one [[package]] table per resolved package, including the local root.
function packageTables(lock) {
  return lock.split(/^\[\[/m).filter((table) => table.startsWith('package]]'));
}

function packageSources(tables, name) {
  return tables
    .filter((table) => /^name = "([^"\r\n]+)"\r?$/m.exec(table)?.[1] === name)
    .map((table) => /^source = "([^"\r\n]+)"\r?$/m.exec(table)?.[1] ?? '(path)');
}

// Node 24: node --test packages/compiler/test/gpui-target.node-test.mjs
// Set PROTO_UI_GPUI_GENERATOR to use a prebuilt generator. Set PROTO_UI_GPUI_CONSUMER_DIR
// to retain the generated crate after success. Cargo inherits the caller's cache and network policy.
test('external Rust consumer renders and interacts with generated views in headless GPUI TestAppContext', async (t) => {
  const retainedRoot = process.env.PROTO_UI_GPUI_CONSUMER_DIR;
  const scratch = resolve(retainedRoot || tmpdir());
  mkdirSync(scratch, { recursive: true });
  const packageName = `proto-gpui-consumer-${randomUUID()}`;
  const crate = join(scratch, packageName);
  mkdirSync(crate);
  t.diagnostic(`Generated consumer: ${crate}`);

  cpSync(consumerSource, crate, { recursive: true });
  const cargoToml = join(crate, 'Cargo.toml');
  const cargoLock = join(crate, 'Cargo.lock');
  writeFileSync(cargoToml, manifest(packageName), { flag: 'wx' });
  if (existsSync(seedLock)) {
    const lock = readFileSync(seedLock, 'utf8');
    const sources = packageSources(packageTables(lock), 'gpui');
    if (sources.length === 1 && sources[0] === sdkSource) writeFileSync(cargoLock, lock, { flag: 'wx' });
  }

  const generator = process.env.PROTO_UI_GPUI_GENERATOR;
  const options = generator ? { generator } : undefined;
  const programs = [
    ['delivery_badge', readonlyBadge()],
    ['selection_control', controlledSelection()],
  ];
  for (const [module, program] of programs) {
    const rust = await emitGpui(program, options);
    writeFileSync(join(crate, 'src', `${module}.rs`), rust, { flag: 'wx' });
  }

  const result = spawnSync('cargo', ['test', '--manifest-path', cargoToml, '--test', 'native'], {
    cwd: crate,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  if (result.stdout) t.diagnostic(result.stdout.trimEnd());
  assert.ifError(result.error);
  assert.equal(result.status, 0, `cargo test failed (${result.signal ?? result.status}) in ${crate}`);
  const summary = /^test result: ok\. (\d+) passed; 0 failed; 0 ignored; 0 measured; 0 filtered out;/m.exec(result.stdout);
  assert.ok(summary, 'Cargo must execute the native tests without ignored or filtered cases');
  assert.ok(Number(summary[1]) >= 6, 'the six external consumer cases must all run');
  const resolved = packageTables(readFileSync(cargoLock, 'utf8'));
  assert.deepEqual(packageSources(resolved, packageName), ['(path)'], 'Cargo must resolve this unique consumer');
  assert.deepEqual(packageSources(resolved, 'gpui'), [sdkSource]);
  t.diagnostic(`Resolved GPUI: ${sdkSource}`);
  if (!retainedRoot) rmSync(crate, { recursive: true });
});
