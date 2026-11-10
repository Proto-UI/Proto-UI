// Operator-only producer. Executing it imports the real Compiler; never give it to a blind consumer.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileFile, compilationArtifacts, writeCompilation, verifyConsumerClosure } from '../../../packages/compiler/src/index.ts';
import { json, listFiles, readJson, safeFile, sha256, writeNew } from '../../benchmark/evidence.mjs';
import { loadProtocol, outputDigest } from './study.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = fs.realpathSync(fileURLToPath(new URL('../../../', import.meta.url)));
const within = (root, filename) => {
  const relative = path.relative(root, filename);
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
};
const ref = (root, filename) => ({ path: path.relative(root, filename).split(path.sep).join('/'), sha256: sha256(fs.readFileSync(filename)) });
function save(root, filename, value) {
  writeNew(root, filename, json(value));
  return ref(root, safeFile(root, filename));
}
function revision() {
  const result = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout.trim(), /^[a-f0-9]{40}$/);
  return result.stdout.trim();
}
function recordBuild(root, cwd) {
  const argv = ['npm', 'run', 'build'];
  const startedAt = new Date().toISOString();
  const cleanEnv = { ...process.env, PATH: `${path.dirname(process.execPath)}${path.delimiter}${process.env.PATH ?? ''}`, NODE_PATH: '', NODE_OPTIONS: '' };
  delete cleanEnv.TSX_TSCONFIG_PATH;
  const result = spawnSync(argv[0], argv.slice(1), { cwd, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, env: cleanEnv });
  writeNew(root, 'operator/build.stdout.log', result.stdout ?? '');
  writeNew(root, 'operator/build.stderr.log', result.stderr ?? '');
  const receipt = save(root, 'operator/build.result.json', {
    argv, cwd, startedAt, finishedAt: new Date().toISOString(), exitCode: result.status,
    nodeExecutable: process.execPath, nodeVersion: process.version,
    signal: result.signal, error: result.error?.message ?? null,
    stdout: ref(root, safeFile(root, 'operator/build.stdout.log')), stderr: ref(root, safeFile(root, 'operator/build.stderr.log')),
  });
  return { receipt, ok: result.status === 0 && result.signal === null && result.error === undefined };
}
async function prepare(root) {
  assert.match(process.versions.node, /^24\./, 'Use the repository Node24 toolchain');
  assert.ok(!within(repo, root), 'Producer output must be outside the repository');
  assert.ok(!fs.existsSync(root), 'Choose a fresh output directory; prior attempts remain intact');
  fs.mkdirSync(root, { recursive: false });
  const head = revision();
  save(root, 'operator/producer-input.json', {
    schemaVersion: 1, evidenceClass: 'operator-preflight', compilerRevision: head, sourceRevision: head,
    node: process.version, producerSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    protocolSha256: loadProtocol().sha256, profile: 'react-dom-source-v1',
    entry: 'packages/prototypes/base/src/button/button.proto.ts',
    warning: 'Compilation/staging is not artifact admission or an unaware consumer result.',
  });
  const compilerInputs = [];
  for (const file of listFiles(path.join(repo, 'packages/compiler/src'))) {
    const source = path.join(repo, 'packages/compiler/src', file);
    const destination = `operator/compiler-src/${file}`;
    writeNew(root, destination, fs.readFileSync(source));
    compilerInputs.push(ref(root, safeFile(root, destination)));
  }
  writeNew(root, 'operator/repository-pnpm-lock.yaml', fs.readFileSync(path.join(repo, 'pnpm-lock.yaml')));
  const startedAt = new Date().toISOString();
  const compiled = await compileFile(path.join(repo, 'packages/prototypes/base/src/button/button.proto.ts'), {
    root: repo, profile: 'react-dom-source-v1', componentName: 'GeneratedButton',
  });
  const compileResult = save(root, 'operator/compile-result.json', compiled.ok ? { ok: true, diagnostics: [], profile: compiled.value.output.profile } : compiled);
  if (!compiled.ok) {
    save(root, 'candidate.json', { status: 'compiler-rejected', compileResult, observedConsumerRuns: 0 });
    process.exitCode = 1;
    return;
  }
  const inputs = [];
  for (const input of compiled.value.ir.sourceFiles) {
    const absolute = path.resolve(repo, input.file);
    assert.ok(within(repo, absolute), `Source is outside the declared repository: ${input.file}`);
    const bytes = fs.readFileSync(absolute);
    assert.equal(sha256(bytes), input.sha256, `Compiler input changed: ${input.file}`);
    const destination = `operator/source/${path.relative(repo, absolute).split(path.sep).join('/')}`;
    writeNew(root, destination, bytes);
    inputs.push(ref(root, safeFile(root, destination)));
  }
  const artifactDirectory = path.join(root, 'distribution/generated');
  const written = await writeCompilation(compiled.value, artifactDirectory);
  save(root, 'operator/write-result.json', written);
  assert.equal(written.ok, true, 'Compiler refused the fresh output destination; retain diagnostic');
  const artifacts = compilationArtifacts(compiled.value);
  const outputs = artifacts.map((artifact) => {
    const filename = safeFile(artifactDirectory, artifact.path);
    assert.equal(sha256(fs.readFileSync(filename)), sha256(artifact.contents), `Written output differs: ${artifact.path}`);
    return ref(root, filename);
  });
  const generationText = json({ compiled: readJson(safeFile(root, 'operator/compile-result.json')), written });
  writeNew(root, 'operator/generation.stdout.log', generationText);
  writeNew(root, 'operator/generation.stderr.log', '');
  const generation = save(root, 'operator/generation.result.json', {
    argv: [process.execPath, ...process.execArgv, ...process.argv.slice(1)], cwd: process.cwd(), startedAt, finishedAt: new Date().toISOString(), exitCode: 0, signal: null, error: null,
    stdout: ref(root, safeFile(root, 'operator/generation.stdout.log')), stderr: ref(root, safeFile(root, 'operator/generation.stderr.log')),
  });
  const provenance = readJson(path.join(artifactDirectory, 'provenance.json'));
  assert.equal(provenance.profile, 'react-dom-source-v1');
  for (const dependency of provenance.dependencies) {
    assert.equal(dependency.role, 'target', `Disallowed native-source dependency role: ${dependency.name}`);
    assert.ok(!dependency.name.startsWith('@proto.ui/'), `Internal dependency: ${dependency.name}`);
  }
  const consumer = path.join(root, 'clean-consumer');
  fs.cpSync(path.join(here, 'starter'), consumer, { recursive: true, errorOnExist: true, force: false });
  fs.cpSync(artifactDirectory, path.join(consumer, 'generated'), { recursive: true, errorOnExist: true, force: false });
  const packageJson = readJson(path.join(consumer, 'package.json'));
  packageJson.dependencies = { ...packageJson.dependencies, ...Object.fromEntries(provenance.dependencies.map((dependency) => [dependency.name, dependency.version])) };
  fs.writeFileSync(path.join(consumer, 'package.json'), json(packageJson));
  // This informed operator mount is separate from the untouched participant starter.
  fs.writeFileSync(path.join(consumer, 'src/App.tsx'), `import * as React from 'react';
import { GeneratedButton } from '../generated/Component';
export function App() {
  const [count, setCount] = React.useState(0);
  const [disabled, setDisabled] = React.useState(false);
  return <main><h1>Artifact preflight</h1><GeneratedButton disabled={disabled} onClick={() => setCount(value => value + 1)}>Save preference</GeneratedButton><output aria-label="Activations">{count}</output><label><input type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} />Disable action</label></main>;
}
`);
  const dependencies = provenance.dependencies.map((dependency) => `${dependency.name}@${dependency.version}`).join(' ');
  writeNew(root, 'distribution/USAGE.md', `# Generated Button\n\nThis is an editable local source distribution for React 19.2.6, not a registry package. Copy the entire generated directory, including its hidden helper directories, into your project. Install the declared dependencies:\n\n\`npm install ${dependencies}\`\n\nImport \`{ GeneratedButton }\` from \`./generated/Component\`. Supply label content as children, a boolean \`disabled\`, and \`onClick\` for an activation. Keep supporting files and provenance with the source. The Base control has no promised visual-family paint; inspect the generated source and use ordinary consumer styling. Editing output makes the original compiler maps/provenance historical; keep a preimage and build fresh consumer maps.\n\nThis distribution's exact behavioral bounds must accompany its independently admitted evidence. Source provenance is retained unchanged.\n`);
  const candidate = {
    schemaVersion: 1, status: 'awaiting-clean-consumer-and-independent-admission', kind: 'generated-source',
    scope: 'Base Button', profile: 'react-dom-source-v1', target: { framework: 'react', version: '19.2.6' },
    sourceRevision: head, compilerRevision: head, inputs, compilerInputs, compileResult, generation,
    outputs, outputInventorySha256: outputDigest(outputs), provenance: ref(root, path.join(artifactDirectory, 'provenance.json')),
    distribution: { method: 'directory-copy', directory: 'distribution/generated', instructions: ref(root, path.join(root, 'distribution/USAGE.md')) },
    observedConsumerRuns: 0,
  };
  save(root, 'candidate.json', candidate);
  process.stdout.write(json({ status: candidate.status, root, consumer, candidate: ref(root, path.join(root, 'candidate.json')) }));
}
async function verify(root) {
  const candidate = readJson(safeFile(root, 'candidate.json'));
  assert.equal(candidate.status, 'awaiting-clean-consumer-and-independent-admission');
  for (const output of candidate.outputs) assert.equal(sha256(fs.readFileSync(safeFile(root, output.path))), output.sha256, `Distribution changed: ${output.path}`);
  const consumer = safeFile(root, 'clean-consumer');
  for (const output of candidate.outputs) {
    const relative = path.relative(candidate.distribution.directory, output.path);
    assert.equal(sha256(fs.readFileSync(safeFile(consumer, `generated/${relative.split(path.sep).join('/')}`))), output.sha256, `Consumer output differs: ${relative}`);
  }
  const build = recordBuild(root, consumer);
  assert.ok(build.ok, 'Actual clean consumer build failed; preserve its stdout/stderr/status');
  const provenance = readJson(path.join(consumer, 'generated/provenance.json'));
  // Reuse the existing dependency-only verifier projection: original provenance is immutable.
  const dependencyProvenance = { ...provenance };
  delete dependencyProvenance.helpers;
  writeNew(consumer, 'dependency-provenance.json', json(dependencyProvenance));
  const expected = { profile: candidate.profile, dependencies: provenance.dependencies, generatedFiles: provenance.artifacts.filter((artifact) => artifact.kind === 'source').map((artifact) => `generated/${artifact.path}`), provenanceFile: 'dependency-provenance.json' };
  const closure = await verifyConsumerClosure(consumer, expected);
  const consumerClosure = save(root, 'operator/consumer-closure.json', closure);
  assert.equal(closure.ok, true, 'Clean consumer dependency/import closure is invalid');
  assert.equal(closure.value.internal.length, 0, 'Clean native consumer reaches an internal package');
  writeNew(consumer, 'negative-controls/internal-import.ts', "import '@proto.ui/runtime';\n");
  const leaked = await verifyConsumerClosure(consumer, { ...expected, generatedFiles: [...expected.generatedFiles, 'negative-controls/internal-import.ts'] });
  const absent = await verifyConsumerClosure(consumer, { ...expected, helpers: [{ name: '__absentStudyHelper', version: '1', classification: 'native-lowering', delivery: 'inline' }] });
  save(root, 'operator/injected-closure-controls.json', { evidenceClass: 'injected-control', internalImport: leaked, missingHelper: absent });
  assert.equal(leaked.ok, false, 'Internal-import mutation was not rejected');
  assert.ok(leaked.failures.some((failure) => failure.code === 'undeclared-import'));
  assert.equal(absent.ok, false, 'Missing-helper mutation was not rejected');
  assert.ok(absent.failures.some((failure) => failure.code === 'missing-helper'));
  const shippedFiles = listFiles(path.join(consumer, 'dist')).map((file) => ref(root, path.join(consumer, 'dist', file)));
  assert.ok(shippedFiles.length > 0, 'Build produced no production files');
  save(root, 'clean-consumer.json', {
    status: 'operator-preflight-only', evidenceClass: 'operator-preflight',
    cleanConsumerBuild: build.receipt, consumerClosure, shippedFiles,
    lockfile: ref(root, path.join(consumer, 'package-lock.json')), observedConsumerRuns: 0,
    remaining: ['Real production-browser scope evidence', 'Independent artifact-bound admission', 'Fixed-lock untouched participant starter', 'No-onboarding measured participant journey'],
  });
  process.stdout.write(json({ status: 'operator-preflight-only', observedConsumerRuns: 0, root }));
}

const [, , operation, requestedRoot] = process.argv;
if (!['prepare', 'verify'].includes(operation) || !requestedRoot || !path.isAbsolute(requestedRoot) || process.argv.length !== 4) throw new Error('Usage: node --import tsx produce-button.mjs <prepare|verify> <fresh-absolute-root>');
const root = operation === 'prepare' ? path.join(fs.realpathSync(path.dirname(requestedRoot)), path.basename(requestedRoot)) : fs.realpathSync(requestedRoot);
assert.ok(!within(repo, root), 'Evidence must be outside the source repository');
if (operation === 'prepare') await prepare(root);
else await verify(root);
