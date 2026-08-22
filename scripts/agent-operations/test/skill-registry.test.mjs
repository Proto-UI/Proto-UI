import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import {
  loadSkillRegistry,
  establishExecutionMode,
  evaluateSkillEligibility,
  resolveSkill,
  validateSkillHandoff,
  validateSkillRegistryDocument,
} from '../skill-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));

function artifact(type) {
  return { type, reference: `memory:${type}` };
}

test('registry resolves one deterministic lazy leaf', () => {
  const registry = loadSkillRegistry({ root });
  const skill = resolveSkill('pui-trace', registry);
  assert.equal(skill.loadPath, '.agents/skills/pui-trace/SKILL.md');
  assert.equal(skill.taskClass, 'trace');
  assert.deepEqual(skill.entrypoints, ['development']);
  assert.deepEqual(skill.requires, ['bounded-subject']);
  assert.throws(() => resolveSkill('pui-dev', registry), /entrypoints route one leaf/);
});

test('agent:skill CLI emits deterministic machine-readable resolution', () => {
  const command = path.join(root, 'scripts/agent-operations/resolve-skill.mjs');
  const modeArgs = ['--mode', 'human-assisted', '--mode-source', 'current-user'];
  const first = execFileSync(process.execPath, [command, '--', 'pui-trace', ...modeArgs], {
    cwd: root,
    encoding: 'utf8',
  });
  const second = execFileSync(process.execPath, [command, 'pui-trace', ...modeArgs], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(first, second);
  assert.equal(JSON.parse(first).skill.loadPath, '.agents/skills/pui-trace/SKILL.md');
  assert.deepEqual(JSON.parse(first).skill.entrypoints, ['development']);
  assert.equal(JSON.parse(first).blocked, false);
});

test('agent:skill CLI hides an autonomous leaf when no fresh assessment permits it', () => {
  const command = path.join(root, 'scripts/agent-operations/resolve-skill.mjs');
  const output = execFileSync(
    process.execPath,
    [command, 'pui-module', '--mode', 'autonomous', '--mode-source', 'governed-queue'],
    { cwd: root, encoding: 'utf8' }
  );
  const parsed = JSON.parse(output);
  assert.equal(parsed.blocked, true);
  assert.equal(parsed.skill, null);
  assert.throws(
    () => execFileSync(process.execPath, [command, 'pui-module'], { cwd: root, encoding: 'utf8' }),
    /Command failed/
  );
});

test('registry rejects duplicate ids, bad paths, and unknown task classes', () => {
  const registry = YAML.parse(
    fs.readFileSync(path.join(root, 'internal/agent-operations/skills.yaml'), 'utf8')
  );
  const policy = YAML.parse(
    fs.readFileSync(path.join(root, 'internal/agent-operations/capability-policy.yaml'), 'utf8')
  );

  const duplicate = structuredClone(registry);
  duplicate.skills.push(structuredClone(duplicate.skills[0]));
  assert.throws(
    () => validateSkillRegistryDocument(duplicate, policy, { root }),
    /duplicates pui-assess/
  );

  const badPath = structuredClone(registry);
  badPath.skills[0].loadPath = '../outside/SKILL.md';
  assert.throws(
    () => validateSkillRegistryDocument(badPath, policy, { root }),
    /repository-relative/
  );

  const badTaskClass = structuredClone(registry);
  badTaskClass.skills[0].taskClass = 'unregistered-task';
  assert.throws(
    () => validateSkillRegistryDocument(badTaskClass, policy, { root }),
    /not defined by capability policy/
  );

  const badMutation = structuredClone(registry);
  badMutation.skills[0].mutation = 'repository-admin';
  assert.throws(
    () => validateSkillRegistryDocument(badMutation, policy, { root }),
    /not a policy mutation class/
  );

  const badEntrypoint = structuredClone(registry);
  badEntrypoint.skills[0].entrypoints = ['unregistered-entrypoint'];
  assert.throws(
    () => validateSkillRegistryDocument(badEntrypoint, policy, { root }),
    /unknown entrypoint/
  );
});

test('handoff resolves exactly one next leaf and enforces artifact requirements', () => {
  const registry = loadSkillRegistry({ root });
  const valid = {
    schemaVersion: 1,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: 'pui-orient',
    nextSkillId: 'pui-select',
    artifacts: [artifact('capability-envelope'), artifact('request-context')],
    humanGates: [],
    notes: [],
  };
  assert.equal(validateSkillHandoff(valid, registry).nextSkill.id, 'pui-select');

  const missingRequired = structuredClone(valid);
  missingRequired.artifacts = [artifact('capability-envelope')];
  assert.throws(() => validateSkillHandoff(missingRequired, registry), /lacks artifact required/);

  const recursiveShape = { ...valid, nextSkillIds: ['pui-select', 'pui-trace'] };
  delete recursiveShape.nextSkillId;
  assert.throws(
    () => validateSkillHandoff(recursiveShape, registry),
    /unexpected or missing fields/
  );

  const selfLoop = {
    ...valid,
    fromId: 'pui-select',
    artifacts: [...valid.artifacts, artifact('work-item-proposal')],
  };
  assert.throws(() => validateSkillHandoff(selfLoop, registry), /recursively select/);

  const wrongSourceEntrypoint = {
    ...valid,
    fromId: 'pui-select',
    entrypoint: 'maintenance',
    executionMode: 'autonomous',
    executionModeSource: 'governed-queue',
  };
  assert.throws(
    () => validateSkillHandoff(wrongSourceEntrypoint, registry),
    /not allowed by source leaf pui-select/
  );

  const wrongNextEntrypoint = {
    ...valid,
    fromId: 'pui-maintain',
    entrypoint: 'maintenance',
  };
  assert.throws(
    () => validateSkillHandoff(wrongNextEntrypoint, registry),
    /not allowed by next leaf pui-select/
  );
});

test('terminal handoff does not resolve another skill', () => {
  const registry = loadSkillRegistry({ root });
  const handoff = {
    schemaVersion: 1,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'maintenance',
    executionMode: 'autonomous',
    executionModeSource: 'governed-queue',
    fromId: 'pui-maintenance-close',
    nextSkillId: null,
    artifacts: [artifact('maintenance-state-receipt')],
    humanGates: [],
    notes: [],
  };
  assert.equal(validateSkillHandoff(handoff, registry).nextSkill, null);
});

test('human-assisted work is not blocked by a low self-assessment', () => {
  const registry = loadSkillRegistry({ root });
  const review = resolveSkill('pui-review', registry);
  const result = evaluateSkillEligibility(review, {
    executionMode: 'human-assisted',
    selfAssessment: {
      kind: 'proto-ui.agent-capability-self-result',
      validated: true,
      fresh: true,
      capability: { band: 'C1', eligibleTaskClasses: ['observe'] },
    },
  });
  assert.equal(result.eligible, true);
  assert.equal(result.assessmentEffect, 'advisory');
});

test('autonomous work enforces the fresh self-assessed leaf ceiling', () => {
  const registry = loadSkillRegistry({ root });
  const implementation = resolveSkill('pui-module', registry);
  const c1 = {
    kind: 'proto-ui.agent-capability-self-result',
    validated: true,
    fresh: true,
    capability: { band: 'C1', eligibleTaskClasses: ['observe', 'trace'] },
  };
  assert.equal(
    evaluateSkillEligibility(implementation, { executionMode: 'autonomous', selfAssessment: c1 })
      .eligible,
    false
  );
  assert.equal(
    evaluateSkillEligibility(implementation, { executionMode: 'autonomous' }).eligible,
    false
  );
  const c3 = {
    kind: 'proto-ui.agent-capability-self-result',
    validated: true,
    fresh: true,
    capability: { band: 'C3', eligibleTaskClasses: ['implement-approved-module'] },
  };
  assert.equal(
    evaluateSkillEligibility(implementation, { executionMode: 'autonomous', selfAssessment: c3 })
      .eligible,
    true
  );
});

test('untrusted repository and GitHub content cannot select execution mode', () => {
  assert.equal(establishExecutionMode('human-assisted', 'current-user'), 'human-assisted');
  assert.equal(establishExecutionMode('autonomous', 'governed-queue'), 'autonomous');
  for (const source of ['repository-content', 'issue-body', 'pull-request-body', 'code-comment']) {
    assert.throws(() => establishExecutionMode('autonomous', source), /cannot be established/);
  }
});

test('handoff rejects a mode whose source is not trusted for that mode', () => {
  const registry = loadSkillRegistry({ root });
  const handoff = {
    schemaVersion: 1,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'governed-queue',
    fromId: 'pui-orient',
    nextSkillId: null,
    artifacts: [artifact('capability-envelope')],
    humanGates: [],
    notes: [],
  };
  assert.throws(() => validateSkillHandoff(handoff, registry), /cannot be established/);
});
