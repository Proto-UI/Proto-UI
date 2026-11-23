// Source -> checked compiler -> unmodified Rust/SDK in one ordinary Cargo consumer.
import { createHash } from 'node:crypto';
import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { compileFile, writeCompilation } from '../../../src/compile.ts';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'gpui-git': { type: 'string' },
    'gpui-rev': { type: 'string' },
    'gpui-text-selection-notification': { type: 'boolean', default: false },
    'lockfile': { type: 'string' },
  },
});
const output = positionals[0];
if (positionals.length !== 1 || !path.isAbsolute(output ?? '') || existsSync(output))
  throw new Error('Provide a fresh absolute output directory.');
const workspace = values['gpui-git'] !== undefined || values['gpui-rev'] !== undefined;
const git = values['gpui-git'] ?? 'https://github.com/zed-industries/zed';
const rev = values['gpui-rev'] ?? '62e5991dd0f0c8a3af8d5e7e9c4652490d468db8';
const sdkFeatures = [
  'test-support',
  ...(values['gpui-text-selection-notification'] ? ['gpui-text-selection-notification'] : []),
];
if (
  !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(git) ||
  !/^[a-f0-9]{40}$/.test(rev)
)
  throw new Error('Use an exact GitHub GPUI source and full revision.');
const fixture = path.dirname(fileURLToPath(import.meta.url));
const compiled = await compileFile(path.join(fixture, 'value.proto.ts'), {
  root: fixture,
  profile: 'gpui-source-v1',
  ...(workspace ? { gpuiDependency: 'workspace' } : {}),
});
if (!compiled.ok) throw new Error(JSON.stringify(compiled.diagnostics));
await mkdir(output);
const component = path.join(output, 'component');
const written = await writeCompilation(compiled.value, component);
if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
const manifest = await readFile(path.join(component, 'Cargo.toml'), 'utf8');
const provenance = JSON.parse(await readFile(path.join(component, 'provenance.json'), 'utf8'));
const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
if (!name) throw new Error('Missing emitted package name.');
const controls = [];
for (const stem of [
  'activation',
  'host-activation',
  'text',
  'press-modifiers',
  'tab-focus',
  'tab-scope',
]) {
  const result = await compileFile(path.join(fixture, stem + '.proto.ts'), {
    root: fixture,
    profile: 'gpui-source-v1',
    nativeSdkPath: '../component/.proto-ui/gpui-native',
    ...(workspace ? { gpuiDependency: 'workspace' } : {}),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  const written = await writeCompilation(result.value, path.join(output, stem));
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  const manifest = await readFile(path.join(output, stem, 'Cargo.toml'), 'utf8');
  const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
  if (!name) throw new Error('Missing emitted control package name: ' + stem);
  controls.push({ stem, name });
}
await writeFile(
  path.join(output, 'Cargo.toml'),
  `[package]
name = "proto-ui-gpui-a11y-value-consumer"
version = "0.1.0"
edition = "2021"
publish = false

[workspace]
resolver = "2"
members = ["component", ${controls.map((control) => JSON.stringify(control.stem)).join(', ')}, "component/.proto-ui/gpui-native"]

[workspace.dependencies]
gpui = { git = ${JSON.stringify(git)}, rev = ${JSON.stringify(rev)} }

[dependencies]
component = { package = ${JSON.stringify(name)}, path = "component" }
${controls.map((control) => `${control.stem.replaceAll('-', '_')} = { package = ${JSON.stringify(control.name)}, path = ${JSON.stringify(control.stem)} }`).join('\n')}
proto-ui-gpui-native = { path = "component/.proto-ui/gpui-native", features = ${JSON.stringify(sdkFeatures)} }
gpui = { workspace = true, features = ["test-support"] }
serde_json = "1.0"
`,
  { flag: 'wx' }
);
await mkdir(path.join(output, 'tests'));
await copyFile(path.join(fixture, 'consumer.rs'), path.join(output, 'tests', 'a11y_value.rs'));
await copyFile(
  path.join(fixture, 'sequential_focus.rs'),
  path.join(output, 'tests', 'sequential_focus.rs')
);
const lockfile = values.lockfile ?? path.resolve(fixture, '../gpui-ordinary-values/Cargo.lock');
await copyFile(lockfile, path.join(output, 'Cargo.lock'));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const receipt = {
  schemaVersion: 1,
  kind: 'generated-gpui-numeric-accessibility-bridge',
  compilerProfile: 'gpui-source-v1',
  gpui: { git, rev, workspace },
  nativeSdkFeatures: sdkFeatures,
  sourceSha256: sha256(await readFile(path.join(fixture, 'value.proto.ts'))),
  controls: await Promise.all(
    controls.map(async (control) => ({
      ...control,
      sourceSha256: sha256(await readFile(path.join(fixture, control.stem + '.proto.ts'))),
    }))
  ),
  consumerSha256: sha256(await readFile(path.join(fixture, 'consumer.rs'))),
  sequentialFocusConsumerSha256: sha256(await readFile(path.join(fixture, 'sequential_focus.rs'))),
  generatedPackageName: name,
  nativeSdk: provenance.nativeSdk,
  seedLockSha256: sha256(await readFile(lockfile)),
  generatedRustEdited: false,
  platformAccessibilityDelivery: 'requires-separate-OS-evidence',
  lockUpdate:
    'Run cargo metadata without --locked once to add this exact generated package, then use --locked for admission and native tests.',
};
await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify({ output, ...receipt }, null, 2));
