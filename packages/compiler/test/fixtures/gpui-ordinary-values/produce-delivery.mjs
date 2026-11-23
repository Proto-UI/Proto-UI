// Small source -> emitted SDK -> native regression consumer. No emitted Rust is edited.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePrototype } from '../../../src/parser.ts';
import { emitGpuiSource } from '../../../src/gpui-source.ts';

const fixture = path.dirname(fileURLToPath(import.meta.url));
const output = process.argv[2];
if (!output || !path.isAbsolute(output) || existsSync(output))
  throw new Error('Provide a fresh absolute output directory.');
const digest = (value) => createHash('sha256').update(value).digest('hex');
const source = readFileSync(path.join(fixture, 'validation.proto.ts'), 'utf8');
const parsed = parsePrototype(source, { fileName: 'validation.proto.ts' });
if (!parsed.ok) throw new Error(JSON.stringify(parsed.diagnostics));
const emitted = emitGpuiSource(parsed.value);
if (!emitted.ok) throw new Error(JSON.stringify(emitted.diagnostics));
const artifacts = [
  { path: 'Component.rs', contents: emitted.value.code },
  ...emitted.value.supportingFiles,
];
for (const file of artifacts) {
  const target = path.join(output, 'validation', file.path);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, file.contents);
}
const manifest = readFileSync(path.join(output, 'validation/Cargo.toml'), 'utf8');
const name = /^\s*name\s*=\s*"([^"]+)"/m.exec(manifest)?.[1];
const gpui = manifest
  .split('\n')
  .find((line) => /^\s*gpui\s*=/.test(line) && line.includes('test-support'))
  ?.trim();
if (!name || !gpui)
  throw new Error('The emitted crate must retain its actual name and GPUI dependency.');
const consumerManifest = [
  '[package]',
  'name = "proto-ui-native-delivery-regressions"',
  'version = "0.1.0"',
  'edition = "2021"',
  '[workspace]',
  'members = ["validation", "validation/.proto-ui/gpui-native"]',
  '[lib]',
  'path = "empty.rs"',
  '[features]',
  'test-support = ["proto-ui-gpui-native/test-support"]',
  '[dependencies]',
  gpui,
  'serde_json = "1.0"',
  'validation = { package = ' +
    JSON.stringify(name) +
    ', path = "validation", features = ["test-support"] }',
  'proto-ui-gpui-native = { path = "validation/.proto-ui/gpui-native", features = ["test-support"] }',
  '',
].join('\n');
writeFileSync(path.join(output, 'Cargo.toml'), consumerManifest);
writeFileSync(path.join(output, 'empty.rs'), '');
mkdirSync(path.join(output, 'tests'));
copyFileSync(path.join(fixture, 'delivery.rs'), path.join(output, 'tests/delivery.rs'));
writeFileSync(
  path.join(output, 'source-receipt.json'),
  JSON.stringify(
    {
      schemaVersion: 1,
      kind: 'actual-generated-native-delivery-regressions',
      source: {
        path: 'packages/compiler/test/fixtures/gpui-ordinary-values/validation.proto.ts',
        sha256: digest(source),
      },
      consumerSha256: digest(readFileSync(path.join(fixture, 'delivery.rs'))),
      consumerManifestSha256: digest(consumerManifest),
      modules: [
        {
          name,
          files: artifacts.map((file) => ({
            path: file.path,
            sha256: digest(file.contents),
            bytes: Buffer.byteLength(file.contents),
          })),
        },
      ],
    },
    null,
    2
  ) + '\n'
);
console.log(JSON.stringify({ output, name, files: artifacts.length }));
