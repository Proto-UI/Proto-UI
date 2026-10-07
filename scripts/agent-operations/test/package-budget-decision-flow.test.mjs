import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import {
  loadSkillRegistry,
  validateSkillHandoff,
  validateSkillRegistryDocument,
} from '../skill-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const artifact = (type, reference = `file:///budget-input/${type}.json`) => ({
  type,
  reference,
  digest: `sha256:${'a'.repeat(64)}`,
});
const afterNumericEdit = () => ({
  schemaVersion: 1,
  kind: 'proto-ui.skill-handoff',
  entrypoint: 'development',
  executionMode: 'human-assisted',
  executionModeSource: 'current-user',
  fromId: 'pui-package-budget',
  nextSkillId: 'pui-validate',
  artifacts: [
    artifact('capability-envelope'),
    artifact('authority-map'),
    artifact('candidate-change', 'file:///budget-output/changed-candidate.json'),
    artifact('evidence-report', 'file:///budget-input/pre-mutation-cost-report.json'),
    artifact('implementation-authorization'),
    artifact('review-input'),
  ],
  humanGates: [],
  notes: [],
});

test('old cost evidence cannot route a numeric mutation directly to review or integration', () => {
  const registry = loadSkillRegistry({ root });
  const handoff = afterNumericEdit();
  assert.equal(validateSkillHandoff(handoff, registry).nextSkill.id, 'pui-validate');
  assert.throws(
    () => validateSkillHandoff({ ...handoff, nextSkillId: 'pui-review' }, registry),
    /pui-package-budget must continue through one of: pui-validate/
  );
  const fullySuppliedIntegration = {
    ...handoff,
    nextSkillId: 'pui-integrate',
    artifacts: [
      ...handoff.artifacts,
      ...['review-packet', 'published-review-packet', 'mutation-authorization'].map((type) =>
        artifact(type)
      ),
    ],
  };
  assert.throws(
    () => validateSkillHandoff(fullySuppliedIntegration, registry),
    /pui-package-budget must continue through one of: pui-validate/
  );
});

test('a numeric edit cannot terminate with old evidence or an unchanged-input claim', () => {
  const registry = loadSkillRegistry({ root });
  const received = {
    ...afterNumericEdit(),
    fromId: 'pui-validate',
    nextSkillId: 'pui-package-budget',
    artifacts: afterNumericEdit().artifacts.map((item) =>
      item.type === 'candidate-change' ? artifact('candidate-change') : item
    ),
  };
  const edited = { ...afterNumericEdit(), nextSkillId: null };
  assert.throws(() => validateSkillHandoff(edited, registry));
  assert.throws(() => validateSkillHandoff(edited, registry, { priorHandoff: received }));
});

test('the real resolver CLI rejects the stale-report shortcut and permits validation', () => {
  const temporary = mkdtempSync(path.join(os.tmpdir(), 'pui-budget-flow-'));
  const file = path.join(temporary, 'handoff.json');
  const priorFile = path.join(temporary, 'received.json');
  const run = (handoff, priorHandoff) => {
    writeFileSync(file, JSON.stringify(handoff));
    if (priorHandoff) writeFileSync(priorFile, JSON.stringify(priorHandoff));
    return spawnSync(
      process.execPath,
      [
        'scripts/agent-operations/resolve-skill.mjs',
        '--handoff',
        file,
        ...(priorHandoff ? ['--prior-handoff', priorFile] : []),
      ],
      {
        cwd: root,
        encoding: 'utf8',
      }
    );
  };
  try {
    const invalid = run({ ...afterNumericEdit(), nextSkillId: 'pui-review' });
    assert.equal(invalid.status, 1);
    assert.match(invalid.stderr, /pui-package-budget must continue through one of: pui-validate/);
    const valid = run(afterNumericEdit());
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).skill.id, 'pui-validate');
    const received = {
      ...afterNumericEdit(),
      fromId: 'pui-validate',
      nextSkillId: 'pui-package-budget',
      artifacts: afterNumericEdit().artifacts.map((item) =>
        item.type === 'candidate-change' ? artifact('candidate-change') : item
      ),
    };
    const blocked = {
      ...received,
      fromId: 'pui-package-budget',
      nextSkillId: null,
      notes: ['Canonical input measurements are unavailable; no numeric edit. Collect them first.'],
    };
    assert.equal(run(blocked).status, 1);
    const unchanged = run(blocked, received);
    assert.equal(unchanged.status, 0, unchanged.stderr);
    assert.equal(JSON.parse(unchanged.stdout).terminal, true);
    assert.equal(run({ ...afterNumericEdit(), nextSkillId: null }, received).status, 1);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
});

test('declared next-leaf constraints are registered, nonrecursive and nonempty', () => {
  const registry = YAML.parse(
    readFileSync(path.join(root, 'internal/agent-operations/skills.yaml'), 'utf8')
  );
  const policy = YAML.parse(
    readFileSync(path.join(root, 'internal/agent-operations/capability-policy.yaml'), 'utf8')
  );
  const budget = registry.skills.find((skill) => skill.id === 'pui-package-budget');
  assert.deepEqual(budget.allowedNextSkillIds, ['pui-validate']);
  assert.equal(
    validateSkillRegistryDocument(registry, policy, { root }).byId.get(budget.id).id,
    budget.id
  );
  for (const [ids, reason] of [
    [[], /allowedNextSkillIds must be a non-empty array/],
    [['pui-validate', 'pui-validate'], /duplicates pui-validate/],
    [['pui-package-budget'], /cannot select itself/],
    [['pui-unknown-budget-route'], /unregistered leaf/],
    [['pui-dev'], /unregistered leaf/],
    [['pui-observe'], /compatible entrypoint/],
  ]) {
    const invalid = structuredClone(registry);
    invalid.skills.find((skill) => skill.id === budget.id).allowedNextSkillIds = ids;
    assert.throws(() => validateSkillRegistryDocument(invalid, policy, { root }), reason);
  }
});

test('budget routing remains narrow and does not impose the new edge on unrelated leaves', () => {
  const registry = loadSkillRegistry({ root });
  assert.equal(
    validateSkillHandoff(
      { ...afterNumericEdit(), fromId: 'pui-docs', nextSkillId: 'pui-review' },
      registry
    ).nextSkill.id,
    'pui-review'
  );
});

test('blocked budget work can terminate and a validated candidate can reach independent review', () => {
  const registry = loadSkillRegistry({ root });
  const blocked = {
    ...afterNumericEdit(),
    nextSkillId: null,
    artifacts: afterNumericEdit().artifacts.map((item) =>
      item.type === 'candidate-change' ? artifact('candidate-change') : item
    ),
    notes: ['No numeric edit; canonical input measurements are unavailable. Collect them first.'],
  };
  const received = { ...blocked, fromId: 'pui-validate', nextSkillId: 'pui-package-budget' };
  assert.equal(validateSkillHandoff(blocked, registry, { priorHandoff: received }).nextSkill, null);
  const reviewedCandidate = {
    ...afterNumericEdit(),
    fromId: 'pui-validate',
    nextSkillId: 'pui-review',
    artifacts: afterNumericEdit().artifacts.map((item) =>
      item.type === 'evidence-report'
        ? {
            ...item,
            reference: 'file:///budget-output/final-candidate-report.json',
            digest: `sha256:${'b'.repeat(64)}`,
          }
        : item
    ),
  };
  assert.equal(
    validateSkillHandoff(reviewedCandidate, registry, { priorHandoff: afterNumericEdit() })
      .nextSkill.id,
    'pui-review'
  );
  for (const type of ['evidence-report', 'review-input', 'candidate-change']) {
    assert.throws(
      () =>
        validateSkillHandoff(
          {
            ...reviewedCandidate,
            artifacts: reviewedCandidate.artifacts.filter((item) => item.type !== type),
          },
          registry
        ),
      new RegExp(`artifact.*${type}`)
    );
  }
});
