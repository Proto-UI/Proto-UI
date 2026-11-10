// Run only in the parent's admitted product slot with Node 24. This produces
// source and ordinary consumer manifests; it never installs dependencies or runs Cargo.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const { values } = parseArgs({ options: {
  output: { type: 'string' }, binding: { type: 'string' },
  'upstream-sdk': { type: 'string' }, phase: { type: 'string', default: 'after' },
} });
if (process.versions.node.split('.')[0] !== '24') throw new Error('Use the admitted Node 24 executable.');
if (!values.output || !isAbsolute(values.output) || existsSync(values.output)) throw new Error('--output must name a fresh absolute directory.');
if (!values.binding || !values['upstream-sdk'] || !isAbsolute(values['upstream-sdk'])) throw new Error('Require --binding and the actual absolute --upstream-sdk checkout.');
if (!['before', 'after'].includes(values.phase)) throw new Error('--phase is before or after.');
const fixture = dirname(fileURLToPath(import.meta.url));
const root = resolve(fixture, '../../../../..');
const bindingBytes = readFileSync(values.binding);
const binding = JSON.parse(bindingBytes);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
if (resolve(binding.compilerRoot) !== root || resolve(binding.sdkRoot) !== resolve(values['upstream-sdk'])) throw new Error('Binding selects another source root.');
if (binding.phase !== values.phase) throw new Error('Before/after phase does not match the retained source binding.');
const compilerFiles = [...new Map([...binding.files, ...(binding.publicFiles ?? [])].map((file) => [file.path, file])).values()];
const sourceSets = [['compiler', root, compilerFiles],
  ['sdk', values['upstream-sdk'], binding.sdkFiles]];
for (const [, sourceRoot, files] of sourceSets) {
  for (const file of files) {
    if (digest(readFileSync(join(sourceRoot, file.path))) !== file.sha256) throw new Error(`Source changed before production: ${file.path}`);
  }
}
mkdirSync(values.output);
mkdirSync(join(values.output, 'receipts'));
writeFileSync(join(values.output, 'receipts', 'source-binding.json'), bindingBytes);
for (const [group, sourceRoot, files] of sourceSets) {
  for (const file of files) {
    const destination = join(values.output, 'receipts', `${group}-source`, file.path);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(sourceRoot, file.path), destination);
  }
}
const producerSha256 = digest(readFileSync(fileURLToPath(import.meta.url)));
copyFileSync(fileURLToPath(import.meta.url), join(values.output, 'receipts', 'producer.mjs'));
const manifestName = 'Cargo.toml';
const results = [];
const shared = join(values.output, 'owned', '.proto-ui', 'gpui-native');
const compile = (name, input, sourceRoot, exportName) => {
  const args = ['--import', 'tsx', 'packages/compiler/src/cli-entry.ts', 'compile', input,
    '--root', sourceRoot, '--output', join(values.output, name), '--profile', 'gpui-source-v1', '--json'];
  if (exportName) args.push('--export', exportName);
  if (name !== 'owned') args.push('--native-sdk-path', shared);
  const result = spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  writeFileSync(join(values.output, 'receipts', `${name}.stdout`), stdout);
  writeFileSync(join(values.output, 'receipts', `${name}.stderr`), stderr);
  const entry = { name, input, sourceRoot, exportName: exportName ?? 'default',
    inputSha256: digest(readFileSync(join(root, input))), command: [process.execPath, ...args],
    status: result.status, signal: result.signal, error: result.error?.message ?? null,
    stdoutSha256: digest(stdout), stderrSha256: digest(stderr),
    produced: result.status === 0 && existsSync(join(values.output, name, manifestName)) };
  results.push(entry);
  return entry;
};
const inputRoot = 'packages/compiler/test/fixtures/gpui-native-template';
const atomic = [
  ['owned', 'focus-region.proto.ts'], ['manual', 'focus-region.proto.ts', 'ManualRegion'],
  ['default', 'focus-region.proto.ts', 'DefaultRegion'], ['container', 'focus-region.proto.ts', 'ContainerRegion'],
  ['target', 'focus-target.proto.ts'], ['text', 'focus-target.proto.ts', 'TextTarget'],
];
for (const [name, source, exportName] of atomic) compile(name, `${inputRoot}/${source}`, inputRoot, exportName);
// Compile unmodified real public sources. A diagnostic remains a failure with
// its exact input/stdout/stderr; atomic success cannot substitute for Content.
const publicRoot = 'packages/prototypes/base';
const publicParts = [
  ['public-root', 'root.proto.ts'], ['public-trigger', 'trigger.proto.ts'], ['public-content', 'content.proto.ts'],
];
for (const [name, source] of publicParts) compile(name, `${publicRoot}/src/popover/${source}`, publicRoot);
const owner = results.find((result) => result.name === 'owned');
const publicComplete = publicParts.every(([name]) => results.find((result) => result.name === name)?.produced);
const atomicComplete = atomic.every(([name]) => results.find((result) => result.name === name)?.produced);
const copied = [];
if (atomicComplete) {
  const manifestPath = join(values.output, 'owned', manifestName);
  const original = readFileSync(manifestPath, 'utf8');
  writeFileSync(join(values.output, 'receipts', 'owned.generated.Cargo.toml'), original);
  let manifest = original;
  const dependencies = [
    ['focus_manual', 'manual'], ['focus_default', 'default'], ['focus_container', 'container'],
    ['focus_target', 'target'], ['focus_text', 'text'],
    ...(publicComplete ? [['public_popover_root', 'public-root'], ['public_popover_trigger', 'public-trigger'], ['public_popover_content', 'public-content']] : []),
  ];
  for (const [alias, directory] of dependencies) {
    const dependencyManifest = readFileSync(join(values.output, directory, manifestName), 'utf8');
    const packageName = dependencyManifest.match(/^\s*name\s*=\s*"([^"]+)"/m)?.[1];
    if (!packageName) throw new Error(`Missing generated package name: ${directory}`);
    manifest += `\n${alias} = { package = ${JSON.stringify(packageName)}, path = ${JSON.stringify(`../${directory}`)} }\n`;
  }
  manifest += `\n[patch."https://github.com/zed-industries/zed"]\ngpui = { path = ${JSON.stringify(join(values['upstream-sdk'], 'crates/gpui'))} }\n`;
  writeFileSync(manifestPath, manifest);
  mkdirSync(join(values.output, 'owned', 'tests'));
  const tests = [['focus-consumer.rs', 'focus_consumer.rs'],
    ...(values.phase === 'after' ? [['focus-foreign-consumer.rs', 'focus_foreign_consumer.rs']] : []),
    ...(publicComplete ? [['focus-public-content-consumer.rs', 'focus_public_content_consumer.rs']] : [])];
  for (const [source, target] of tests) {
    copyFileSync(join(fixture, source), join(values.output, 'owned', 'tests', target));
    copied.push({ source, target, sha256: digest(readFileSync(join(fixture, source))) });
  }
}
const sourceAfter = sourceSets.flatMap(([group, sourceRoot, files]) => files.map((file) => {
  const sha256 = digest(readFileSync(join(sourceRoot, file.path)));
  return { group, path: file.path, expectedSha256: file.sha256, sha256, unchanged: sha256 === file.sha256 };
}));
const sourceUnchanged = sourceAfter.every((file) => file.unchanged);
const receipt = { schemaVersion: 1, kind: 'source-production-only', compilerRoot: root,
  phase: values.phase, upstreamSdk: values['upstream-sdk'], bindingSha256: digest(bindingBytes),
  producerSha256, node: process.version, results, atomicComplete, publicComplete, copied,
  sourceAfter, sourceUnchanged,
  localPatchOnly: true, public62eCompatibility: false,
  generatedLock: 'NOT CREATED OR ADMITTED', dependencyClosure: 'NOT ADMITTED',
  cargoAndNativeChecks: 'UNRUN',
  publicDiagnosticOwner: 'Generic authored-source parser/IR/target owner; preserve the actual diagnostic and source. Do not ban/substitute valid authored Content.',
  publicDiagnosticExpectation: 'The real Content includes a TryStatement in hasLivePart. If reached, current parser.ts reports PUI1004 Unsupported TryStatement statement.; this is a source-supported expectation, not an observed diagnostic.',
};
writeFileSync(join(values.output, 'source-only-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
console.log(JSON.stringify({ output: values.output, atomicComplete, publicComplete, cargoAndNativeChecks: 'UNRUN' }));
if (!owner?.produced || !atomicComplete || !publicComplete || !sourceUnchanged) process.exitCode = 1;
