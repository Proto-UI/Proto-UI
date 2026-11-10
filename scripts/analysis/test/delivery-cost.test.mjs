import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { admitDeliveryPlan, analyzeDeliveryRun, buildDeliveryRun, prepareNativeConsumerPlan, sampleStatistics } from '../delivery-cost.mjs';

const script = fileURLToPath(new URL('../delivery-cost.mjs', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const load = (filename) => JSON.parse(readFileSync(filename, 'utf8'));
const save = (filename, value) => writeFileSync(filename, JSON.stringify(value, null, 2) + '\n');

// These are injected accounting controls. Their small JS modules and provenance
// are not Proto compiler output, a supported target, or benchmark measurements.
function fixture(t, { css = false, invalid = false } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), 'delivery-cost-control-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const root = path.join(directory, 'consumer');
  mkdirSync(root);
  const put = (name, contents) => {
    mkdirSync(path.dirname(path.join(root, name)), { recursive: true });
    writeFileSync(path.join(root, name), contents);
  };
  put('package.json', '{"name":"injected-accounting-control","version":"1.0.0","type":"module"}\n');
  put('package-lock.json', '{"name":"injected-accounting-control","lockfileVersion":3,"packages":{}}\n');
  put('shared.ts', 'export function shared(n) { return n + Math.random(); }\n');
  put('unused.ts', 'export function unused() { return "unreached-control"; }\n');
  put('first.ts', invalid ? 'const = ;\n' : `import {shared} from './shared'; import {unused} from './unused'; ${css ? "import './style.css';" : ''} console.log(shared(10));\n`);
  put('second.ts', `import {shared} from './shared'; ${css ? "import './style.css';" : ''} console.log(shared(20));\n`);
  if (css) {
    put('style.css', 'body { color: #123; background-image: url(./control.svg); }\n');
    put('control.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><path d="M0 0h1v1H0z"/></svg>\n');
  }
  const ref = (name) => ({ path: name, sha256: hash(readFileSync(path.join(root, name))) });
  const plan = {
    schemaVersion: 1,
    scope: { id: 'injected-accounting-control', requirements: ['control:shared-chunk-and-real-output-accounting'], sourceRevision: '0'.repeat(40), review: null },
    environment: { host: 'web', framework: 'plain-js-accounting-control', frameworkVersion: '1', buildMode: 'production' },
    repetitions: 2,
    arms: [
      { id: 'runtime-adapter', status: 'unavailable', reason: 'No Proto Adapter is exercised by this injected tool control.' },
      { id: 'generated', status: 'unavailable', reason: 'No Proto Compiler is exercised by this injected tool control.' },
      { id: 'host-native', status: 'available', root, profile: 'injected-accounting-control', entryPoints: ['first.ts', 'second.ts'],
        lockfile: ref('package-lock.json'), portableSources: [], correctness: { status: 'untested', evidence: null, differences: ['These controls do not establish common primitive semantics.'] } },
    ],
  };
  const planFile = path.join(directory, 'plan.json');
  const evidence = path.join(directory, 'evidence');
  return { directory, root, put, ref, plan, planFile, evidence,
    async build() { save(planFile, plan); return buildDeliveryRun(planFile, evidence); } };
}

function injectedGenerated(f) {
  f.put('source/subject.proto.ts', 'INJECTED ACCOUNTING CONTROL; NOT A PROTO PROGRAM\n');
  f.put('generated/Component.ts', 'export const value = 42;\n');
  f.put('generated/provenance.json', JSON.stringify({ profile: 'injected-accounting-control', artifacts: [
    { kind: 'source', path: 'Component.ts', sha256: f.ref('generated/Component.ts').sha256 },
  ] }));
  f.put('generated-entry.ts', "import {value} from './generated/Component'; console.log(value);\n");
  const arm = { ...structuredClone(f.plan.arms[2]), id: 'generated',
    entryPoints: ['generated-entry.ts'], portableSources: [{ key: 'subject', ...f.ref('source/subject.proto.ts') }],
    provenance: f.ref('generated/provenance.json') };
  f.plan.arms[1] = arm;
  return arm;
}

test('real production builds count shared chunks once, follow CSS/assets, and separate maps and dropped input', async (t) => {
  const f = fixture(t, { css: true });
  const report = await f.build();
  const arm = report.arms.find((item) => item.id === 'host-native');
  assert.equal(report.ok, true);
  assert.equal(report.comparison.status, 'withheld');
  assert.equal(report.arms.find((item) => item.id === 'generated').status, 'unavailable');
  assert.equal(arm.samples.length, 4);
  for (const sample of arm.samples) {
    const accounting = sample.accounting;
    assert.ok(accounting.sharedAcrossEntries.bytes > 0);
    assert.ok(accounting.delivered.files.some((file) => file.path.endsWith('.svg')));
    assert.ok(accounting.delivered.files.some((file) => file.path.endsWith('.css')));
    assert.ok(accounting.debugMaps.bytes > 0);
    assert.equal(accounting.delivered.files.some((file) => file.path.endsWith('.map')), false);
    assert.equal(accounting.retainedInputs.some((input) => input.input === 'unused.ts'), false);
    assert.equal(accounting.deliveryClosureComplete, true);
    const fileBytes = new Map(accounting.delivered.files.map((file) => [file.key, file.bytes]));
    const separatelySummedEntries = accounting.entries.reduce((total, entry) => total + entry.files.reduce((sum, key) => sum + fileBytes.get(key), 0), 0);
    assert.ok(separatelySummedEntries > accounting.delivered.bytes, 'Shared chunk must be counted once in the union, rather than once per entry.');
    assert.equal(accounting.perInstanceCost, null);
  }
  assert.equal(arm.buildTime.minified.successful, 2);
  assert.ok(Number.isFinite(arm.buildTime.minified.sampleVarianceMs2));
  assert.equal(arm.startup, null);
  assert.equal(arm.memory, null);
  assert.equal(report.originalCriteria.some((criterion) => criterion.completed), false);
  const restored = analyzeDeliveryRun(load(path.join(f.evidence, 'run.json')), f.evidence);
  assert.deepEqual(restored, report);
});

test('stale lock/source bindings and escaping inputs reject before a bundler or output directory is created', async (t) => {
  const f = fixture(t);
  f.put('package-lock.json', '{"changed":true}\n');
  await assert.rejects(f.build(), /digest mismatch: package-lock.json/);
  assert.equal(existsSync(f.evidence), false);
  f.plan.arms[2].lockfile = f.ref('package-lock.json');
  f.plan.arms[2].entryPoints = ['../outside.ts'];
  assert.throws(() => admitDeliveryPlan(f.plan, f.directory), /invalid relative path/);
  f.plan.arms[2].entryPoints = ['first.ts'];
  const outside = path.join(f.directory, 'outside.ts');
  writeFileSync(outside, 'console.log("outside");\n');
  symlinkSync(outside, path.join(f.root, 'escape.ts'));
  f.plan.arms[2].entryPoints = ['escape.ts'];
  assert.throws(() => admitDeliveryPlan(f.plan, f.directory), /escapes its recorded root/);
});

test('retained dependency accounting identifies two actual installed package instances', async (t) => {
  const f = fixture(t);
  f.put('node_modules/duplicate/package.json', '{"name":"duplicate","version":"1.0.0","type":"module","main":"index.js"}');
  f.put('node_modules/duplicate/index.js', 'export const value = Math.random();');
  f.put('node_modules/bridge/package.json', '{"name":"bridge","version":"1.0.0","type":"module","main":"index.js"}');
  f.put('node_modules/bridge/index.js', "export {value as nested} from 'duplicate';");
  f.put('node_modules/bridge/node_modules/duplicate/package.json', '{"name":"duplicate","version":"2.0.0","type":"module","main":"index.js"}');
  f.put('node_modules/bridge/node_modules/duplicate/index.js', 'export const value = Math.random();');
  f.put('first.ts', "import {value} from 'duplicate'; import {nested} from 'bridge'; console.log(value, nested);");
  const report = await f.build();
  const sample = report.arms.find((arm) => arm.id === 'host-native').samples[0].accounting;
  const duplicate = sample.multiplePhysicalPackageInstances.find((item) => item.name === 'duplicate');
  assert.equal(duplicate.instances.length, 2);
  assert.deepEqual(duplicate.instances.map((item) => item.version).sort(), ['1.0.0', '2.0.0']);
  assert.ok(duplicate.instances.every((item) => item.retainedInputBytes > 0 && item.manifest.sha256));
});

test('real generated-consumer import reachability is required, with immutable provenance bytes', async (t) => {
  const f = fixture(t);
  injectedGenerated(f);
  const report = await f.build();
  const generated = report.arms.find((arm) => arm.id === 'generated');
  assert.ok(generated.samples.every((sample) => sample.accounting.retainedInputs.some((input) => input.input === 'generated/Component.ts')));
  assert.equal(report.comparison.status, 'withheld');
  f.put('generated/Component.ts', 'export const value = 43;\n');
  assert.throws(() => analyzeDeliveryRun(load(path.join(f.evidence, 'run.json')), f.evidence), /digest mismatch: Component.ts/);
});

test('a generated label cannot turn an unrelated host-native bundle into generated evidence', async (t) => {
  const f = fixture(t);
  const generated = injectedGenerated(f);
  generated.entryPoints = ['first.ts'];
  await assert.rejects(f.build(), /retains no declared generated source/);
  assert.ok(existsSync(path.join(f.evidence, 'run.json')), 'Keep actual completed build attempts when analysis rejects their scope.');
  assert.equal(existsSync(path.join(f.evidence, 'report.json')), false);
});

test('Runtime+Adapter and generated portable identities must match before production work begins', (t) => {
  const f = fixture(t);
  const generated = injectedGenerated(f);
  f.put('source/other.proto.ts', 'DIFFERENT INJECTED ACCOUNTING CONTROL\n');
  f.plan.arms[0] = { ...structuredClone(generated), id: 'runtime-adapter',
    portableSources: [{ key: 'subject', ...f.ref('source/other.proto.ts') }] };
  assert.throws(() => admitDeliveryPlan(f.plan, f.directory), /different portable source identities/);
  assert.equal(existsSync(f.evidence), false);
});

test('native preparation preserves edited source and old provenance while restoring only authenticated pre-edit bytes', async (t) => {
  const f = fixture(t);
  // Injected receipt grammar control, not an actual Compiler/Happy DOM result.
  const original = 'export const value = 42;\n';
  const edited = 'export const value = 43;\n';
  f.put('generated/Component.ts', edited);
  const profileEvidence = f.directory;
  mkdirSync(path.join(profileEvidence, 'compiler-input'));
  const source = 'INJECTED RECEIPT GRAMMAR CONTROL; NOT A PROTO PROGRAM\n';
  writeFileSync(path.join(profileEvidence, 'compiler-input/entry.proto.ts'), source);
  const provenance = { profile: 'react-dom-source-v1', dependencies: [{ name: 'react', version: '19.2.6', role: 'target' }],
    sourceFiles: [{ file: 'entry.proto.ts', sha256: hash(source) }],
    artifacts: [{ path: 'Component.ts', kind: 'source', sha256: hash(original) }] };
  const provenanceBytes = JSON.stringify(provenance, null, 2) + '\n';
  f.put('generated/provenance.json', provenanceBytes);
  writeFileSync(path.join(profileEvidence, 'Component.before-edit.txt'), original);
  save(path.join(profileEvidence, 'source-ownership.json'), { source: 'Component.ts', beforeSha256: hash(original), afterSha256: hash(edited) });
  save(path.join(profileEvidence, 'runtime-original.json'), { profile: 'react-dom-source-v1', ok: true, scope: 'Injected grammar control, not a run.' });
  for (const filename of ['timing.json', 'costs.json', 'closure-result.json', 'installed-tree-integrity.json'])
    save(path.join(profileEvidence, filename), { scope: 'Injected receipt grammar control; no product result.' });
  const planFile = path.join(profileEvidence, 'native-plan.json');
  writeFileSync(path.join(profileEvidence, 'Component.before-edit.txt'), 'wrong original bytes');
  assert.throws(() => prepareNativeConsumerPlan(profileEvidence, '0'.repeat(40), planFile), /retained original or edited consumer/);
  assert.equal(existsSync(path.join(f.root, 'delivery-original')), false);
  writeFileSync(path.join(profileEvidence, 'Component.before-edit.txt'), original);
  const plan = prepareNativeConsumerPlan(profileEvidence, '0'.repeat(40), planFile);
  assert.equal(readFileSync(path.join(f.root, 'generated/Component.ts'), 'utf8'), edited);
  assert.equal(readFileSync(path.join(f.root, 'generated/provenance.json'), 'utf8'), provenanceBytes);
  assert.equal(readFileSync(path.join(f.root, 'delivery-original/generated/Component.ts'), 'utf8'), original);
  assert.equal(readFileSync(path.join(f.root, 'delivery-original/generated/provenance.json'), 'utf8'), provenanceBytes);
  assert.equal(plan.arms[0].status, 'unavailable');
  assert.equal(plan.arms[2].status, 'unavailable');
  assert.equal(plan.arms[1].correctness.status, 'untested');
  const report = await buildDeliveryRun(planFile, f.evidence);
  assert.equal(report.ok, true);
  assert.equal(report.comparison.status, 'withheld');
  assert.throws(() => prepareNativeConsumerPlan(profileEvidence, '0'.repeat(40), planFile), /plan already exists/);
});

test('failed production attempts and declared correctness differences remain beside null statistics', async (t) => {
  const f = fixture(t, { invalid: true });
  f.plan.arms[2].correctness = { status: 'failed', evidence: null, differences: ['Injected source is invalid; no runtime correctness result.'] };
  const report = await f.build();
  const arm = report.arms.find((item) => item.id === 'host-native');
  assert.equal(report.ok, false);
  assert.equal(arm.correctness.status, 'failed');
  assert.equal(arm.correctness.differences.length, 1);
  assert.equal(arm.samples.length, 4);
  assert.ok(arm.samples.every((sample) => sample.status === 'failed' && sample.failure.errors.length > 0 && sample.wallMs >= 0));
  assert.equal(arm.buildTime.minified.unsuccessful, 2);
  assert.equal(arm.buildTime.minified.meanMs, null);
  assert.equal(arm.buildTime.minified.sampleVarianceMs2, null);
  assert.ok(existsSync(path.join(f.evidence, 'attempt-0004.json')));
  assert.equal(report.comparison.status, 'withheld');
});

test('external asset cost remains unresolved, and corrupted retained bytes never keep their old accounting', async (t) => {
  const f = fixture(t, { css: true });
  f.put('style.css', 'body { background: url(https://example.invalid/unmeasured.png); }\n');
  const report = await f.build();
  const accounting = report.arms.find((arm) => arm.id === 'host-native').samples[0].accounting;
  assert.equal(accounting.deliveryClosureComplete, false);
  assert.ok(accounting.external.some((edge) => edge.path === 'https://example.invalid/unmeasured.png'));
  const file = accounting.delivered.files.find((item) => item.path.endsWith('.js'));
  const filename = path.join(f.evidence, accounting.outputDirectory, file.path);
  const bytes = readFileSync(filename);
  bytes[0] ^= 1;
  writeFileSync(filename, bytes);
  assert.throws(() => analyzeDeliveryRun(load(path.join(f.evidence, 'run.json')), f.evidence), /inventory drift/);
});

test('empty availability, incomplete attempts and duplicate output ownership cannot produce successful receipts', async (t) => {
  const f = fixture(t);
  f.plan.arms = f.plan.arms.map((arm) => ({ id: arm.id, status: 'unavailable', reason: 'Injected control has no available path.' }));
  const report = await f.build();
  assert.equal(report.ok, false);
  assert.deepEqual(load(path.join(f.evidence, 'run.json')).samples, []);
  await assert.rejects(f.build(), /EEXIST/);
  const g = fixture(t);
  await g.build();
  const run = load(path.join(g.evidence, 'run.json'));
  run.samples.pop();
  assert.throws(() => analyzeDeliveryRun(run, g.evidence), /missing build attempts/);
});

test('CLI retains failing build receipts and returns nonzero; summary never treats one observation as variance', (t) => {
  const f = fixture(t, { invalid: true });
  f.plan.repetitions = 1;
  save(f.planFile, f.plan);
  const result = spawnSync(process.execPath, [script, 'build', f.planFile, f.evidence], { encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.equal(load(path.join(f.evidence, 'report.json')).ok, false);
  assert.equal(JSON.parse(result.stdout).arms.find((arm) => arm.id === 'host-native').samples.length, 2);
  assert.deepEqual(sampleStatistics([{ status: 'passed', wallMs: 7 }]), {
    successful: 1, unsuccessful: 0, meanMs: 7, minMs: 7, maxMs: 7, sampleVarianceMs2: null,
  });
  assert.equal(sampleStatistics([{ status: 'passed', wallMs: 10 }, { status: 'failed', wallMs: 100 }, { status: 'passed', wallMs: 30 }]).sampleVarianceMs2, 200);
});
