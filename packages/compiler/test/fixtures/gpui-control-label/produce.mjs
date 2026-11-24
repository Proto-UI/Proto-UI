// Compile actual upstream prototypes, never a simplified copy or edited Rust.
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import path from 'node:path';
import { compileFile, writeCompilation } from '../../../src/compile.ts';
import { GPUI_PROFILE_SOURCE } from '../../../src/gpui-dependency.ts';
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    'gpui-git': { type: 'string' },
    'gpui-rev': { type: 'string' },
    'gpui-text-selection-notification': { type: 'boolean', default: false },
    lockfile: { type: 'string' },
  },
});
const output = positionals[0];
if (positionals.length !== 1 || !path.isAbsolute(output ?? '') || existsSync(output))
  throw new Error('Provide one fresh absolute output directory.');
const fixture = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(fixture, '../../../../..');
const workspace = values['gpui-git'] !== undefined || values['gpui-rev'] !== undefined;
const git = values['gpui-git'] ?? GPUI_PROFILE_SOURCE.git;
const rev = values['gpui-rev'] ?? GPUI_PROFILE_SOURCE.revision;
const sdkFeatures = [
  'test-support',
  ...(values['gpui-text-selection-notification'] ? ['gpui-text-selection-notification'] : []),
];
if (
  !/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(git) ||
  !/^[a-f0-9]{40}$/.test(rev)
)
  throw new Error('Use an exact GitHub GPUI revision.');
await mkdir(output);
const sources = [
  ['button', 'button/button'],
  ['label', 'label/root'],
  ['input', 'input/root'],
  ['input_delegate', null],
];
const entries = [];
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
for (const [stem, source] of sources) {
  const entry = source
    ? path.join(root, 'packages/prototypes/base/src', source + '.proto.ts')
    : path.join(fixture, 'input-delegate.proto.ts');
  const result = await compileFile(entry, {
    root,
    profile: 'gpui-source-v1',
    ...(stem === 'button' ? {} : { nativeSdkPath: '../button/.proto-ui/gpui-native' }),
    ...(workspace ? { gpuiDependency: 'workspace' } : {}),
  });
  if (!result.ok)
    throw new Error(
      JSON.stringify({ stem, source: path.relative(root, entry), diagnostics: result.diagnostics })
    );
  const written = await writeCompilation(result.value, path.join(output, stem));
  if (!written.ok) throw new Error(JSON.stringify(written.diagnostics));
  const manifest = await readFile(path.join(output, stem, 'Cargo.toml'), 'utf8');
  const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
  if (!name) throw new Error('Missing generated package name');
  entries.push({
    stem,
    name,
    source: path.relative(root, entry),
    sourceSha256: sha256(await readFile(entry)),
  });
}
await writeFile(
  path.join(output, 'Cargo.toml'),
  `[package]
name="proto-ui-gpui-control-label-consumer"
version="0.1.0"
edition="2021"
publish=false
[workspace]
resolver="2"
members=["button","label","input","input_delegate","button/.proto-ui/gpui-native"]
[workspace.dependencies]
gpui={git=${JSON.stringify(git)},rev=${JSON.stringify(rev)}}
[dependencies]
${entries.map(({ stem, name }) => `${stem}={package=${JSON.stringify(name)},path=${JSON.stringify(stem)}}`).join('\n')}
proto-ui-gpui-native={path="button/.proto-ui/gpui-native",features=${JSON.stringify(sdkFeatures)}}
gpui={workspace=true,features=["test-support"]}
serde_json="1.0"
`,
  { flag: 'wx' }
);
await mkdir(path.join(output, 'tests'));
await copyFile(path.join(fixture, 'consumer.rs'), path.join(output, 'tests/control_label.rs'));
await copyFile(
  values.lockfile ?? path.resolve(fixture, '../gpui-ordinary-values/Cargo.lock'),
  path.join(output, 'Cargo.lock')
);
const receipt = {
  schemaVersion: 1,
  kind: 'official-native-control-label-consumer',
  sources: entries,
  gpui: { git, rev, workspace },
  nativeSdkFeatures: sdkFeatures,
  generatedRustEdited: false,
  consumerSha256: sha256(await readFile(path.join(fixture, 'consumer.rs'))),
};
await writeFile(path.join(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(JSON.stringify({ output, ...receipt }, null, 2));
