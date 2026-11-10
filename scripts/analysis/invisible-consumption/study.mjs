import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { json, listFiles, readJson, safeFile, sha256, verifyEvidence } from '../../benchmark/evidence.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const stages = ['discover-install', 'use', 'customize', 'debug', 'ship'];
const terminalKinds = ['completed', 'failed', 'abandoned'];
const eventKinds = ['start', ...terminalKinds, 'step', 'successful-use', 'internals', 'escape-hatch', 'edit', 'explanation', 'capture'];
const requireThat = (condition, message) => { if (!condition) throw new Error(message); };
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const finiteTime = (value) => Number.isFinite(value) && value >= 0;
const same = isDeepStrictEqual;

function boundFile(root, ref) {
  requireThat(ref && text(ref.path) && /^[a-f0-9]{64}$/.test(ref.sha256), 'Expected a path and SHA-256 file reference');
  const bytes = fs.readFileSync(safeFile(root, ref.path));
  requireThat(sha256(bytes) === ref.sha256, `Changed evidence: ${ref.path}`);
  return bytes;
}
function boundJson(root, ref) {
  return JSON.parse(boundFile(root, ref).toString('utf8'));
}
function boundList(root, refs, label) {
  requireThat(Array.isArray(refs) && refs.length > 0, `Missing ${label}`);
  requireThat(new Set(refs.map((ref) => ref.path)).size === refs.length, `Duplicate ${label}`);
  for (const ref of refs) boundFile(root, ref);
}
function command(root, ref, mustSucceed) {
  const result = boundJson(root, ref);
  requireThat(Array.isArray(result.argv) && result.argv.length > 0 && result.argv.every(text), 'Missing command argv');
  requireThat(text(result.cwd), 'Missing command cwd');
  requireThat(Number.isInteger(result.exitCode) || result.exitCode === null, 'Missing command completion status');
  requireThat(Object.hasOwn(result, 'signal') && Object.hasOwn(result, 'error'), 'Missing signal/error status');
  requireThat(Number.isFinite(Date.parse(result.startedAt)) && Date.parse(result.finishedAt) >= Date.parse(result.startedAt), 'Invalid command time interval');
  boundFile(root, result.stdout);
  boundFile(root, result.stderr);
  if (mustSucceed) requireThat(result.exitCode === 0 && result.signal === null && result.error === null, 'Command did not complete successfully');
  return result;
}
export function outputDigest(outputs) {
  return sha256(json([...outputs].sort((a, b) => a.path.localeCompare(b.path))));
}
export function loadProtocol(filename = path.join(here, 'protocol.json')) {
  const bytes = fs.readFileSync(filename);
  const protocol = JSON.parse(bytes.toString('utf8'));
  requireThat(protocol.schemaVersion === 1 && protocol.id === 'issue-750-button-consumption-v1', 'Unknown study protocol');
  requireThat(same(protocol.stages, stages) && protocol.timeWindowMs === 3_600_000, 'Changed journey or time window needs a separate protocol');
  boundFile(path.dirname(filename), protocol.task);
  boundList(path.dirname(filename), protocol.starter, 'controlled starter files');
  const actual = listFiles(path.join(path.dirname(filename), 'starter')).map((file) => `starter/${file}`).sort();
  requireThat(same(actual, protocol.starter.map((ref) => ref.path).sort()), 'Starter membership differs from the frozen protocol');
  return { protocol, sha256: sha256(bytes) };
}

function admitArtifact(root, ref, protocol) {
  const artifact = boundJson(root, ref);
  requireThat(artifact.schemaVersion === 1 && artifact.kind === 'generated-source', 'A real source-generated artifact is required');
  requireThat(artifact.profile === protocol.profile && same(artifact.target, protocol.target), 'Artifact target does not match the fixed consumer environment');
  requireThat(artifact.scope === 'Base Button', 'This protocol admits only the initial Button slice');
  requireThat(/^[a-f0-9]{40}$/.test(artifact.compilerRevision) && /^[a-f0-9]{40}$/.test(artifact.sourceRevision), 'Missing exact source/compiler revisions');
  boundList(root, artifact.inputs, 'compiler input preimages');
  boundList(root, artifact.outputs, 'generated output closure');
  const digest = outputDigest(artifact.outputs);
  requireThat(artifact.outputInventorySha256 === digest, 'Generated output inventory digest differs');
  const provenance = boundJson(root, artifact.provenance);
  requireThat(provenance.profile === protocol.profile, 'Compiler provenance has a different profile');
  requireThat(Array.isArray(provenance.sourceFiles) && provenance.sourceFiles.length > 0, 'Missing compiler source graph');
  for (const source of provenance.sourceFiles) requireThat(artifact.inputs.some((input) => input.sha256 === source.sha256), `Compiler source preimage is missing: ${source.file}`);
  requireThat(Array.isArray(provenance.dependencies) && provenance.dependencies.length > 0, 'Missing generated dependency declaration');
  for (const dependency of provenance.dependencies) {
    requireThat(dependency.role === 'target' && !dependency.name.startsWith('@proto.ui/'), 'Runtime/internal dependency is outside this native-source protocol');
  }
  requireThat(Array.isArray(provenance.artifacts) && provenance.artifacts.length > 0, 'Missing compiler artifact inventory');
  for (const item of provenance.artifacts) {
    const match = artifact.outputs.find((output) => output.path === `${artifact.distribution.directory}/${item.path}`);
    requireThat(match && match.sha256 === item.sha256, `Compiler artifact is absent or changed: ${item.path}`);
  }
  requireThat(artifact.outputs.length === provenance.artifacts.length + 1, 'Distribution includes output outside the original compiler closure');
  requireThat(artifact.outputs.some((output) => output.path === artifact.provenance.path), 'Compiler provenance must travel with the output');
  requireThat(artifact.distribution.method === 'directory-copy', 'This protocol uses an editable local distribution, not a promised package');
  boundFile(root, artifact.distribution.instructions);
  boundFile(root, artifact.recipe);
  command(root, artifact.generation, true);
  const generated = boundJson(root, artifact.compileResult);
  requireThat(generated.ok === true, 'Compiler did not produce a successful result');
  command(root, artifact.cleanConsumerBuild, true);
  boundList(root, artifact.shippedFiles, 'clean consumer production output');
  boundFile(root, artifact.lockfile);
  const closure = boundJson(root, artifact.consumerClosure);
  requireThat(closure.ok === true && closure.value.profile === protocol.profile && Array.isArray(closure.value.internal) && closure.value.internal.length === 0, 'Clean consumer closure was not verified without internal packages');
  const review = boundJson(root, artifact.review);
  requireThat(review.disposition === 'admitted-for-experiment' && review.compilerRevision === artifact.compilerRevision && review.outputInventorySha256 === digest && /^https:\/\/github\.com\/Proto-UI\/Proto-UI\//.test(review.url), 'Missing artifact-bound admission; a merge or self-authored manifest is insufficient');
  requireThat(Array.isArray(artifact.supportedBehavior) && artifact.supportedBehavior.length > 0, 'Missing measured supported scope');
  for (const behavior of artifact.supportedBehavior) {
    requireThat(text(behavior.claim), 'Empty behavior claim');
    boundList(root, behavior.evidence, 'supported behavior evidence');
  }
  requireThat(Array.isArray(artifact.omissions) && artifact.omissions.every(text), 'Missing explicit omissions');
  return artifact;
}

function inspectRun(root, ref, frozen, artifactRef, controls, artifact) {
  const run = boundJson(root, ref);
  requireThat(run.schemaVersion === 1 && text(run.id), 'Missing run identity');
  requireThat(['observed-consumer', 'injected-control'].includes(run.evidenceClass), 'Missing observed/control classification');
  requireThat(run.protocolSha256 === frozen.sha256 && run.artifactManifestSha256 === artifactRef.sha256, 'Run uses different fixed inputs');
  requireThat(run.controlLockfileSha256 === controls.lockfile.sha256 && same(run.environment, controls.environment), 'Run starting environment or provided dependency lock differs from controls');
  requireThat(run.taskSha256 === frozen.protocol.task.sha256, 'Participant received a different task');
  requireThat(Array.isArray(run.initialApp) && run.initialApp.length === frozen.protocol.starter.length, 'Incomplete initial app snapshot');
  boundList(root, run.initialApp.map((entry) => entry.file), 'initial app snapshot');
  requireThat(new Set(run.initialApp.map((entry) => entry.starterPath)).size === run.initialApp.length, 'Duplicate starter path');
  for (const expected of frozen.protocol.starter) {
    requireThat(run.initialApp.find((entry) => entry.starterPath === expected.path)?.file.sha256 === expected.sha256, `Initial app changed: ${expected.path}`);
  }
  const participant = run.participant;
  requireThat(participant && text(participant.alias) && text(participant.frameworkExperience) && text(participant.libraryExperience) && ['none', 'some', 'unknown'].includes(participant.priorProtoKnowledge), 'Missing sanitized experience profile');
  requireThat(Number.isFinite(Date.parse(run.startedAt)) && finiteTime(run.endedMs), 'Missing run clock boundary');
  requireThat(run.clock === 'monotonic-ms-from-task-release', 'Use one monotonic journey clock');
  boundFile(root, run.rawLog);
  requireThat(Array.isArray(run.events), 'Missing event log');
  requireThat(Array.isArray(run.limitations) && run.limitations.every(text), 'Missing limitations/confounders');
  requireThat(['supported', 'weakened', 'inconclusive', 'falsified'].includes(run.interpretation?.verdict) && text(run.interpretation.reason), 'Missing bounded operator interpretation');
  const journey = stages.map((stage) => ({ stage, startedMs: null, endedMs: null, outcome: 'not-reached', steps: 0 }));
  const internals = [], escapeHatches = [], modifications = [], captures = [], explanations = [];
  let installedLockfile = null;
  let current = -1, previousMs = 0, firstUseMs = null, abandoned = false;
  for (const event of run.events) {
    requireThat(finiteTime(event.atMs) && event.atMs >= previousMs && event.atMs <= run.endedMs, 'Non-monotonic or out-of-run event');
    previousMs = event.atMs;
    requireThat(eventKinds.includes(event.kind) && text(event.detail), 'Missing event kind/detail');
    boundList(root, event.evidence, 'event evidence');
    if (event.kind === 'start') {
      requireThat(!abandoned && current < stages.length - 1 && event.stage === stages[current + 1], 'Stage was skipped, repeated or started after abandonment');
      requireThat(current < 0 || journey[current].endedMs !== null, 'Previous stage has no terminal outcome');
      current += 1;
      journey[current].startedMs = event.atMs;
    } else {
      requireThat(current >= 0 && event.stage === stages[current] && journey[current].endedMs === null, 'Event is outside its active stage');
      const stage = journey[current];
      if (terminalKinds.includes(event.kind)) {
        stage.endedMs = event.atMs;
        stage.outcome = event.kind;
        abandoned = event.kind === 'abandoned';
        if (event.stage === 'discover-install' && event.kind === 'completed') {
          boundFile(root, event.installedLockfile);
          installedLockfile = event.installedLockfile;
        }
        if (event.stage === 'ship' && event.kind === 'completed') {
          command(root, event.build, true);
          boundList(root, event.shippedFiles, 'participant production output');
          requireThat(captures.some((capture) => capture.stage === 'ship'), 'Shipping requires an observed production-browser capture');
        }
      } else {
        stage.steps += 1;
        if (event.kind === 'successful-use' && firstUseMs === null) firstUseMs = event.atMs;
        if (event.kind === 'internals') internals.push(event);
        if (event.kind === 'escape-hatch') escapeHatches.push(event);
        if (event.kind === 'explanation') explanations.push(event);
        if (event.kind === 'capture') captures.push(event);
        if (event.kind === 'edit') {
          boundFile(root, event.before);
          boundFile(root, event.after);
          boundFile(root, event.diff);
          requireThat(text(event.consumerPath) && ['app', 'generated'].includes(event.ownership), 'Missing edit ownership/path');
          requireThat(event.before.sha256 !== event.after.sha256, 'Edit has identical preimage and result');
          if (event.ownership === 'generated') {
            const expected = artifact.outputs.find((output) => output.path === `${artifact.distribution.directory}/${event.consumerPath}`);
            const prior = modifications.filter((edit) => edit.ownership === 'generated' && edit.consumerPath === event.consumerPath).at(-1);
            requireThat(event.before.sha256 === (prior?.after.sha256 ?? expected?.sha256), 'Generated edit lost its actual prior preimage');
          }
          modifications.push(event);
        }
      }
    }
  }
  for (const stage of journey) stage.durationMs = stage.startedMs === null ? null : (stage.endedMs ?? run.endedMs) - stage.startedMs;
  const stagesCompleted = journey.every((stage) => stage.outcome === 'completed') && firstUseMs !== null;
  const complete = stagesCompleted && modifications.length > 0 && explanations.length > 0;
  const exclusions = [];
  if (run.evidenceClass === 'injected-control') exclusions.push('injected control; never a participant/product result');
  if (participant.priorProtoKnowledge !== 'none') exclusions.push('prior internal knowledge is not the primary no-onboarding baseline');
  if (run.endedMs > frozen.protocol.timeWindowMs) exclusions.push('fixed time window exceeded');
  if (installedLockfile && installedLockfile.sha256 !== controls.lockfile.sha256) exclusions.push('actual installed dependency lock differs from the provided frozen control');
  const reportedInterpretation = run.interpretation;
  return {
    id: run.id, admission: 'retained', evidenceClass: run.evidenceClass, primaryEligible: exclusions.length === 0,
    exclusions, source: ref, participant, journey, stagesCompleted, completed: complete, timeToFirstUseMs: firstUseMs,
    elapsedMs: run.endedMs, installedLockfile, debuggingSucceeded: journey[3].outcome === 'completed',
    internals, escapeHatches, modifications, explanations, captures,
    codeExplanationRecorded: explanations.length > 0, limitations: run.limitations,
    reportedInterpretation,
    interpretationLimit: stagesCompleted && !complete
      ? 'Journey completion is recorded, but code modification/explanation evidence is incomplete.'
      : 'Operator interpretation is retained; the reducer does not infer product benefit, demand or general UX.',
  };
}

export function inspectStudy(packet, evidenceRoot, frozen = loadProtocol()) {
  requireThat(packet.schemaVersion === 1 && Array.isArray(packet.runs), 'Invalid study packet');
  const common = {
    schemaVersion: 1, study: frozen.protocol.id, protocolSha256: frozen.sha256, sourceKeys: frozen.protocol.sourceKeys,
    evidenceTrust: 'Content/digests/shape only. Actual execution, contributor rights, independent admission and participant observations require Main readback; a JSON claim is not authentication.',
  };
  if (packet.artifact === null) {
    return { ...common, status: 'blocked-prerequisite', reason: 'No real generated Button artifact admitted; do not run or interpret a substitute.', observedRuns: 0, measurements: null, suppliedRunReferences: packet.runs, originalCriteriaComplete: false };
  }
  const seal = verifyEvidence(evidenceRoot);
  const artifact = admitArtifact(evidenceRoot, packet.artifact, frozen.protocol);
  const controls = packet.controls;
  requireThat(controls && same(controls.target, frozen.protocol.target), 'Missing fixed control environment');
  requireThat(/^24\./.test(controls.environment?.node) && text(controls.environment?.packageManager) && text(controls.environment?.os) && text(controls.environment?.browser), 'Missing exact Node24/package-manager/OS/browser environment');
  boundFile(evidenceRoot, controls.lockfile);
  requireThat(controls.lockfile.sha256 === artifact.lockfile.sha256, 'Control lockfile differs from the admitted clean consumer');
  const runs = packet.runs.map((ref) => inspectRun(evidenceRoot, ref, frozen, packet.artifact, controls, artifact));
  requireThat(new Set(runs.map((run) => run.id)).size === runs.length, 'Duplicate run identity');
  const primary = runs.filter((run) => run.primaryEligible);
  const observed = runs.filter((run) => run.evidenceClass === 'observed-consumer');
  const completed = primary.filter((run) => run.completed).length;
  return {
    ...common, status: observed.length ? 'observations-recorded' : 'prepared-unmeasured', evidenceSeal: seal,
    artifact: packet.artifact, scope: { profile: artifact.profile, target: artifact.target, supportedBehavior: artifact.supportedBehavior, omissions: artifact.omissions },
    observedRuns: observed.length, primaryRuns: primary.length, injectedControls: runs.length - observed.length,
    measurements: primary.length ? { completed, attempted: primary.length, completionRate: completed / primary.length } : null,
    runs, originalCriteriaComplete: false,
    conclusion: 'Retained task evidence requires independent bounded interpretation; it is not automatic experimental acceptance.',
    remaining: ['Reproduce and independently admit the exact artifact and clean consumer.', 'Measure every journey stage with no-onboarding consumers and retain failures/abandonments.', 'Account for internals, edits, explanations, escape hatches, build/ship and actual rendered evidence.', 'Interpret limitations, demand and optional maintenance questions separately.', 'Keep Issue #750 open until all applicable original conditions and integration are earned.'],
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , packetFile, evidenceRoot] = process.argv;
  if (!packetFile || !evidenceRoot || process.argv.length !== 4) throw new Error('Usage: node study.mjs <packet.json> <sealed-evidence-directory>');
  process.stdout.write(json(inspectStudy(readJson(packetFile), evidenceRoot)));
}
