// Synthetic evidence packets exercise admission/accounting only. No generated component,
// consumer, build, browser or participant is executed by these tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { json, sealEvidence, sha256, writeNew } from '../../../benchmark/evidence.mjs';
import { inspectStudy, loadProtocol, outputDigest } from '../study.mjs';

const studyRoot = fileURLToPath(new URL('../', import.meta.url));
function fixture(t, change = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'study750-control-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (name, value) => {
    const bytes = typeof value === 'string' ? value : json(value);
    writeNew(root, name, bytes);
    return { path: name, sha256: sha256(bytes) };
  };
  const frozen = loadProtocol();
  const log = put('controls/not-a-product-run.txt', 'SYNTHETIC ADMISSION CONTROL: no compiler/consumer/participant was executed.\n');
  const command = put('controls/command.json', { argv: ['injected-control'], cwd: '/injected-control', startedAt: '2026-11-10T00:00:00Z', finishedAt: '2026-11-10T00:00:01Z', exitCode: 0, signal: null, error: null, stdout: log, stderr: log });
  const generated = put('distribution/generated/Component.tsx', 'Synthetic output bytes; never compiled or mounted.\n');
  const input = put('controls/source.txt', 'Synthetic compiler input; never executed.\n');
  const provenance = put('distribution/generated/provenance.json', {
    profile: frozen.protocol.profile, dependencies: [{ name: 'react', version: '19.2.6', role: 'target' }],
    sourceFiles: [{ file: 'control.proto.ts', sha256: input.sha256 }],
    artifacts: [{ path: 'Component.tsx', kind: 'source', sha256: generated.sha256 }],
  });
  const outputs = [generated, provenance];
  const lockfile = put('controls/package-lock.json', { lockfileVersion: 3, packages: {} });
  const shipped = put('controls/production/index.html', 'Synthetic production-output evidence; not a product page.\n');
  const artifact = {
    schemaVersion: 1, kind: 'generated-source', scope: 'Base Button', profile: frozen.protocol.profile, target: frozen.protocol.target,
    sourceRevision: 'a'.repeat(40), compilerRevision: 'b'.repeat(40),
    inputs: [input], outputs,
    outputInventorySha256: outputDigest(outputs), provenance,
    distribution: { method: 'directory-copy', directory: 'distribution/generated', instructions: log },
    recipe: log, generation: command, compileResult: put('controls/compile-result.json', { ok: true }),
    cleanConsumerBuild: command, shippedFiles: [shipped], lockfile,
    consumerClosure: put('controls/closure.json', { ok: true, value: { profile: frozen.protocol.profile, internal: [] } }),
    review: put('controls/review.json', { disposition: 'admitted-for-experiment', compilerRevision: 'b'.repeat(40), outputInventorySha256: outputDigest(outputs), url: 'https://github.com/Proto-UI/Proto-UI/issues/750' }),
    supportedBehavior: [{ claim: 'Synthetic evidence-completeness control only', evidence: [log] }], omissions: ['Every actual product/participant result'],
  };
  const controls = { target: frozen.protocol.target, environment: { node: '24.21.0', packageManager: 'npm synthetic', os: 'synthetic', browser: 'synthetic' }, lockfile };
  const initialApp = frozen.protocol.starter.map((entry) => ({ starterPath: entry.path, file: put(`initial/${entry.path}`, fs.readFileSync(path.join(studyRoot, entry.path), 'utf8')) }));
  const run = {
    schemaVersion: 1, id: 'injected-control', evidenceClass: 'injected-control',
    protocolSha256: frozen.sha256, artifactManifestSha256: null, taskSha256: frozen.protocol.task.sha256,
    controlLockfileSha256: lockfile.sha256, environment: controls.environment, initialApp,
    participant: { alias: 'no-participant-control', frameworkExperience: 'synthetic fixture', libraryExperience: 'synthetic fixture', priorProtoKnowledge: 'none' },
    startedAt: '2026-11-10T00:00:00Z', endedMs: 1000, clock: 'monotonic-ms-from-task-release', rawLog: log,
    limitations: ['Entire packet is an injected bookkeeping control, never an actual consumer run.'],
    interpretation: { verdict: 'inconclusive', reason: 'Synthetic admission fixture; no hypothesis is exercised.' },
    events: [],
  };
  let atMs = 0;
  for (const stage of frozen.protocol.stages) {
    run.events.push({ stage, kind: 'start', atMs: atMs += 10, detail: 'synthetic stage start', evidence: [log] });
    if (stage === 'use') run.events.push({ stage, kind: 'successful-use', atMs: atMs += 10, detail: 'synthetic successful-use marker', evidence: [log] });
    if (stage === 'customize') {
      run.events.push({ stage, kind: 'explanation', atMs: atMs += 10, detail: 'synthetic explanation', evidence: [log] });
      run.events.push({ stage, kind: 'edit', atMs: atMs += 10, detail: 'synthetic generated-source edit', evidence: [log], consumerPath: 'Component.tsx', ownership: 'generated', before: generated, after: put('controls/edited.txt', 'Changed synthetic output bytes.\n'), diff: put('controls/edit.diff', '-Synthetic output bytes\n+Changed synthetic output bytes\n') });
    }
    if (stage === 'ship') run.events.push({ stage, kind: 'capture', atMs: atMs += 10, detail: 'synthetic production capture reference, not a browser result', evidence: [log] });
    run.events.push({ stage, kind: 'completed', atMs: atMs += 10, detail: 'synthetic terminal marker', evidence: [log], ...(stage === 'discover-install' ? { installedLockfile: lockfile } : {}), ...(stage === 'ship' ? { build: command, shippedFiles: [shipped] } : {}) });
  }
  change({ artifact, run, controls, put, log, generated, command, shipped });
  const artifactRef = put('controls/artifact.json', artifact);
  run.artifactManifestSha256 = artifactRef.sha256;
  const runRef = put('controls/run.json', run);
  sealEvidence(root);
  return { root, packet: { schemaVersion: 1, artifact: artifactRef, controls, runs: [runRef] }, frozen };
}
const inspect = ({ root, packet, frozen }) => inspectStudy(packet, root, frozen);

test('missing real artifact remains blocked with zero measurements even if runs were supplied', () => {
  const result = inspectStudy({ schemaVersion: 1, artifact: null, controls: null, runs: [{ path: 'unadmitted-run.json', sha256: 'f'.repeat(64) }] }, '/does-not-exist');
  assert.equal(result.status, 'blocked-prerequisite');
  assert.equal(result.observedRuns, 0);
  assert.equal(result.measurements, null);
  assert.equal(result.suppliedRunReferences.length, 1);
  assert.equal(result.originalCriteriaComplete, false);
});

test('injected full journey records timing and modifications without entering participant rates', (t) => {
  const result = inspect(fixture(t));
  assert.equal(result.status, 'prepared-unmeasured');
  assert.equal(result.observedRuns, 0);
  assert.equal(result.primaryRuns, 0);
  assert.equal(result.measurements, null);
  assert.equal(result.runs[0].completed, true);
  assert.equal(result.runs[0].timeToFirstUseMs, 40);
  assert.equal(result.runs[0].journey[2].durationMs, 30);
  assert.equal(result.runs[0].modifications.length, 1);
  assert.equal(result.runs[0].codeExplanationRecorded, true);
  assert.equal(result.originalCriteriaComplete, false);
});

test('abandonment retains internals, escape hatch and unreached stages', (t) => {
  const result = inspect(fixture(t, ({ run, log }) => {
    run.events = run.events.slice(0, 4);
    run.events.push(
      { stage: 'use', kind: 'internals', atMs: 45, detail: 'synthetic need to inspect protocol concepts', evidence: [log] },
      { stage: 'use', kind: 'escape-hatch', atMs: 46, detail: 'synthetic replacement considered because instructions are insufficient', evidence: [log] },
      { stage: 'use', kind: 'abandoned', atMs: 50, detail: 'synthetic inability to finish', evidence: [log] },
    );
  }));
  assert.equal(result.runs[0].completed, false);
  assert.equal(result.runs[0].internals.length, 1);
  assert.equal(result.runs[0].escapeHatches.length, 1);
  assert.equal(result.runs[0].journey[1].outcome, 'abandoned');
  assert.deepEqual(result.runs[0].journey.slice(2).map((stage) => stage.outcome), ['not-reached', 'not-reached', 'not-reached']);
});

test('previously informed consumers stay visible outside the no-onboarding baseline', (t) => {
  const result = inspect(fixture(t, ({ run }) => { run.participant.priorProtoKnowledge = 'some'; }));
  assert.equal(result.runs.length, 1);
  assert.equal(result.runs[0].primaryEligible, false);
  assert.ok(result.runs[0].exclusions.some((reason) => reason.includes('prior internal knowledge')));
});

test('synthetic observed-input packet retains a failed installation in the attempted denominator', (t) => {
  const result = inspect(fixture(t, ({ run, log }) => {
    run.evidenceClass = 'observed-consumer'; // Parser branch control; still no real participant exists.
    run.events = [run.events[0], { stage: 'discover-install', kind: 'failed', atMs: 500, detail: 'synthetic install failure', evidence: [log] }];
  }));
  assert.equal(result.observedRuns, 1);
  assert.deepEqual(result.measurements, { completed: 0, attempted: 1, completionRate: 0 });
  assert.equal(result.runs[0].installedLockfile, null);
  assert.equal(result.runs[0].timeToFirstUseMs, null);
});

test('dependency changes stay retained as a confounder instead of disappearing', (t) => {
  const result = inspect(fixture(t, ({ run, put }) => {
    run.events.find((event) => event.stage === 'discover-install' && event.kind === 'completed').installedLockfile = put('controls/different-lock.json', { lockfileVersion: 3, changed: true });
  }));
  assert.equal(result.runs.length, 1);
  assert.ok(result.runs[0].exclusions.some((reason) => reason.includes('actual installed dependency lock differs')));
});

test('stage check-offs without code changes and explanation do not count as task completion', (t) => {
  const result = inspect(fixture(t, ({ run }) => { run.events = run.events.filter((event) => !['edit', 'explanation'].includes(event.kind)); }));
  assert.equal(result.runs[0].stagesCompleted, true);
  assert.equal(result.runs[0].completed, false);
});

test('changed generated output is rejected by complete evidence readback', (t) => {
  const data = fixture(t);
  fs.writeFileSync(path.join(data.root, 'distribution/generated/Component.tsx'), 'Different payload\n');
  assert.throws(() => inspect(data), /Evidence digest mismatch/);
});

test('runtime-backed and internal-package artifacts cannot substitute for native source', (t) => {
  assert.throws(() => inspect(fixture(t, ({ artifact }) => { artifact.profile = 'react-runtime-v1'; })), /Artifact target/);
});

test('unverified output cannot be admitted using only a self-authored artifact manifest', (t) => {
  assert.throws(() => inspect(fixture(t, ({ artifact, put }) => { artifact.review = put('controls/unbound-review.json', { disposition: 'admitted-for-experiment', compilerRevision: 'b'.repeat(40), outputInventorySha256: '0'.repeat(64), url: 'https://github.com/Proto-UI/Proto-UI/issues/750' }); })), /artifact-bound admission/);
});

test('failed clean consumer build cannot establish the prerequisite', (t) => {
  assert.throws(() => inspect(fixture(t, ({ artifact, put, log }) => { artifact.cleanConsumerBuild = put('controls/failed-build.json', { argv: ['injected-build'], cwd: '/synthetic', startedAt: '2026-11-10T00:00:00Z', finishedAt: '2026-11-10T00:00:01Z', exitCode: 1, signal: null, error: null, stdout: log, stderr: log }); })), /Command did not complete successfully/);
});

test('a zero-exit wrapper cannot turn an unsupported compiler result into an artifact', (t) => {
  assert.throws(() => inspect(fixture(t, ({ artifact, put }) => { artifact.compileResult = put('controls/unsupported.json', { ok: false, diagnostics: [{ code: 'PUI4001' }] }); })), /Compiler did not produce/);
});

test('a declared compiler helper cannot disappear from a newly hashed output inventory', (t) => {
  assert.throws(() => inspect(fixture(t, ({ artifact, put }) => {
    artifact.outputs = [artifact.provenance];
    artifact.outputInventorySha256 = outputDigest(artifact.outputs);
    artifact.review = put('controls/new-inventory-review.json', { disposition: 'admitted-for-experiment', compilerRevision: artifact.compilerRevision, outputInventorySha256: artifact.outputInventorySha256, url: 'https://github.com/Proto-UI/Proto-UI/issues/750' });
  })), /Compiler artifact is absent or changed/);
});

test('a nominally successful closure that reaches an internal runtime is rejected', (t) => {
  assert.throws(() => inspect(fixture(t, ({ artifact, put }) => { artifact.consumerClosure = put('controls/leaked-closure.json', { ok: true, value: { profile: artifact.profile, internal: [{ name: '@proto.ui/runtime' }] } }); })), /without internal packages/);
});

test('different initial app bytes cannot be pooled under the fixed task', (t) => {
  assert.throws(() => inspect(fixture(t, ({ run, put }) => { run.initialApp[0].file = put('controls/changed-initial.html', '<p>different app</p>'); })), /Initial app changed/);
});

test('non-monotonic timestamps are rejected instead of clamped or sorted', (t) => {
  assert.throws(() => inspect(fixture(t, ({ run }) => { run.events[2].atMs = 0; })), /Non-monotonic/);
});

test('shipping completion needs both an actual build receipt and production-browser evidence', (t) => {
  assert.throws(() => inspect(fixture(t, ({ run }) => { run.events = run.events.filter((event) => event.kind !== 'capture'); })), /production-browser capture/);
});

test('generated code edits must preserve the exact prior output preimage', (t) => {
  assert.throws(() => inspect(fixture(t, ({ run, put }) => { run.events.find((event) => event.kind === 'edit').before = put('controls/foreign-preimage.txt', 'Unrelated preimage\n'); })), /actual prior preimage/);
});

test('a reported success cannot auto-complete original criteria or imply product benefit', (t) => {
  const result = inspect(fixture(t, ({ run }) => { run.interpretation = { verdict: 'supported', reason: 'Synthetic supplied interpretation retained for reducer control only' }; }));
  assert.equal(result.runs[0].reportedInterpretation.verdict, 'supported');
  assert.equal(result.originalCriteriaComplete, false);
  assert.equal(result.measurements, null);
});
