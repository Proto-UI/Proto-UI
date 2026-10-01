import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  evaluateSkillEligibility,
  loadSkillRegistry,
  validateSkillHandoff,
} from '../skill-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const registry = loadSkillRegistry({ root });
const deps = registry.byId.get('pui-deps');
const update = registry.byId.get('pui-dependency-update');
const artifact = (type) => ({ type, reference: `memory:${type}` });

function registeredInputHandoff() {
  return {
    schemaVersion: 1,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: 'pui-dev',
    nextSkillId: deps.id,
    artifacts: deps.requires.map(artifact),
    humanGates: [],
    notes: [],
  };
}

function dependencyReport(extraArtifacts = []) {
  const incoming = registeredInputHandoff();
  return {
    ...incoming,
    fromId: deps.id,
    nextSkillId: null,
    artifacts: [...incoming.artifacts, ...deps.produces.map(artifact), ...extraArtifacts],
  };
}

test('registered dependency-assessment inputs support a terminal report without update authority', () => {
  assert.deepEqual(deps.requires, ['repository-snapshot', 'bounded-question']);
  assert.deepEqual(deps.produces, ['dependency-report']);
  assert.equal(validateSkillHandoff(registeredInputHandoff(), registry).nextSkill.id, deps.id);
  const report = dependencyReport();
  report.notes = ['Missing capability-envelope and implementation-authorization for the update.'];
  assert.equal(validateSkillHandoff(report, registry).nextSkill, null);
  assert.deepEqual(report.humanGates, []);
  assert.throws(
    () => validateSkillHandoff({ ...report, nextSkillId: update.id }, registry),
    /lacks artifact required by pui-dependency-update: capability-envelope/
  );
});

test('dependency update carries existing capability and authorization references with its report', () => {
  const envelope = {
    type: 'capability-envelope',
    reference: 'memory:current-pui-orient-envelope',
    digest: `sha256:${'a'.repeat(64)}`,
  };
  const authorization = {
    type: 'implementation-authorization',
    reference: 'memory:current-bounded-dependency-update-request',
    digest: `sha256:${'b'.repeat(64)}`,
  };
  const handoff = { ...dependencyReport([envelope, authorization]), nextSkillId: update.id };
  const result = validateSkillHandoff(handoff, registry);
  assert.equal(result.nextSkill.id, update.id);
  for (const existing of [envelope, authorization]) {
    assert.deepEqual(
      result.handoff.artifacts.find((item) => item.type === existing.type),
      existing
    );
    const missing = {
      ...handoff,
      artifacts: handoff.artifacts.filter((item) => item.type !== existing.type),
    };
    assert.throws(
      () => validateSkillHandoff(missing, registry),
      new RegExp(`lacks artifact required by pui-dependency-update: ${existing.type}`)
    );
    assert.equal(validateSkillHandoff({ ...missing, nextSkillId: null }, registry).nextSkill, null);
  }
});

test('complete dependency-update artifacts do not bypass autonomous decisions or capability ceilings', () => {
  const handoff = {
    ...dependencyReport(['capability-envelope', 'implementation-authorization'].map(artifact)),
    executionMode: 'autonomous',
    executionModeSource: 'governed-queue',
    nextSkillId: update.id,
  };
  for (const gate of ['unresolved-product-direction', 'privileged-or-irreversible-operation']) {
    const gated = { ...handoff, humanGates: [gate] };
    assert.throws(() => validateSkillHandoff(gated, registry), /must stop/);
    assert.equal(validateSkillHandoff({ ...gated, nextSkillId: null }, registry).nextSkill, null);
  }
  const selfAssessment = {
    kind: 'proto-ui.agent-capability-self-result',
    validated: true,
    fresh: true,
    capability: { band: 'C1', eligibleTaskClasses: ['trace', 'update-governed-dependency'] },
  };
  const context = { executionMode: handoff.executionMode, selfAssessment };
  assert.equal(evaluateSkillEligibility(deps, context).eligible, true);
  assert.equal(evaluateSkillEligibility(update, context).eligible, false);
  assert.equal(
    evaluateSkillEligibility(update, { executionMode: handoff.executionMode }).eligible,
    false
  );
});
