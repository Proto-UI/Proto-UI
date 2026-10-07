import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import { loadSkillRegistry, validateSkillHandoff } from '../skill-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const registry = loadSkillRegistry({ root });
const structural = new Ajv2020({ strict: false, allErrors: true }).compile(
  JSON.parse(
    readFileSync(
      path.join(root, 'internal/agent-operations/schemas/skill-handoff.schema.json'),
      'utf8'
    )
  )
);
const head = 'a'.repeat(40);
const inputDigest = 'b'.repeat(64);
const binding = {
  repositoryId: 'github.com:Proto-UI/Proto-UI',
  scopeId: 'pull-request:825',
  headSha: head,
  reviewInputDigest: inputDigest,
};
const artifact = (type, suffix = type, fields = {}) => ({
  type,
  reference: `fixture:budget-v2/${suffix}`,
  digest: `sha256:${'c'.repeat(64)}`,
  ...fields,
});
const budget = () => ({
  schemaVersion: 2,
  kind: 'proto-ui.skill-handoff',
  entrypoint: 'development',
  executionMode: 'human-assisted',
  executionModeSource: 'current-user',
  fromId: 'pui-package-budget',
  nextSkillId: 'pui-validate',
  outcome: 'completed',
  binding,
  artifacts: [
    artifact('capability-envelope'),
    artifact('authority-map'),
    artifact('candidate-change', 'numeric-diff', { revision: head }),
    artifact('candidate-change', 'transaction-record', { revision: head }),
    artifact('evidence-report', 'baseline-cost', { revision: 'd'.repeat(40), result: 'passed' }),
    artifact('evidence-report', 'candidate-cost', { revision: head, result: 'failed' }),
    artifact('implementation-authorization'),
    artifact('review-input', 'review-input', { revision: head, digest: `sha256:${inputDigest}` }),
  ],
  humanGates: [],
  notes: [],
});

const receivedBudget = () => ({
  ...budget(),
  fromId: 'pui-validate',
  nextSkillId: 'pui-package-budget',
  artifacts: [
    ...budget().artifacts.filter((item) => item.type !== 'candidate-change'),
    artifact('candidate-change', 'measured-feature', { revision: head }),
  ],
});

test('budget validation retains v2 candidate and cost materials without weakening the next-leaf guard', () => {
  const handoff = budget();
  assert.equal(structural(handoff), true, JSON.stringify(structural.errors));
  const result = validateSkillHandoff(handoff, registry);
  assert.equal(result.nextSkill.id, 'pui-validate');
  for (const nextSkillId of ['pui-review', 'pui-integrate', 'pui-ci']) {
    assert.throws(
      () => validateSkillHandoff({ ...handoff, nextSkillId }, registry),
      /pui-package-budget must continue through one of: pui-validate/
    );
  }
  assert.throws(() => validateSkillHandoff({ ...handoff, nextSkillId: null }, registry));
});

test('numeric v2 entry requires a digest on every candidate material', () => {
  const received = receivedBudget();
  received.artifacts.push(artifact('candidate-change', 'related-feature', { revision: head }));
  assert.equal(validateSkillHandoff(received, registry).nextSkill.id, 'pui-package-budget');
  for (const candidate of received.artifacts.filter((item) => item.type === 'candidate-change')) {
    const digestless = {
      ...received,
      artifacts: received.artifacts.map((item) => {
        if (item.reference !== candidate.reference) return item;
        const { digest, ...withoutDigest } = item;
        return withoutDigest;
      }),
    };
    assert.throws(() => validateSkillHandoff(digestless, registry));
    assert.equal(
      validateSkillHandoff(
        { ...digestless, fromId: 'pui-regression', nextSkillId: 'pui-validate' },
        registry
      ).nextSkill.id,
      'pui-validate'
    );
  }
});

test('only the received unchanged v2 candidate can stop before numeric editing', () => {
  const received = receivedBudget();
  const blocked = {
    ...received,
    fromId: 'pui-package-budget',
    nextSkillId: null,
    notes: ['Canonical provenance is incomplete; no numeric edit. Refresh candidate measurements.'],
  };
  assert.equal(validateSkillHandoff(blocked, registry, { priorHandoff: received }).nextSkill, null);
  for (const notes of [[], [' \t\n ', '']]) {
    assert.throws(() =>
      validateSkillHandoff({ ...blocked, notes }, registry, { priorHandoff: received })
    );
  }
  assert.equal(
    validateSkillHandoff({ ...blocked, notes: ['', ...blocked.notes] }, registry, {
      priorHandoff: received,
    }).nextSkill,
    null
  );
  assert.throws(() => validateSkillHandoff(blocked, registry));
  assert.throws(() =>
    validateSkillHandoff({ ...budget(), nextSkillId: null }, registry, { priorHandoff: received })
  );
  const changedDigest = {
    ...blocked,
    artifacts: blocked.artifacts.map((item) =>
      item.type === 'candidate-change' ? { ...item, digest: `sha256:${'e'.repeat(64)}` } : item
    ),
  };
  assert.throws(() => validateSkillHandoff(changedDigest, registry, { priorHandoff: received }));
  assert.throws(() =>
    validateSkillHandoff(blocked, registry, {
      priorHandoff: { ...received, binding: { ...binding, scopeId: 'pull-request:other' } },
    })
  );
  const unbound = {
    ...received,
    artifacts: received.artifacts.map((item) => {
      if (item.type !== 'candidate-change') return item;
      const { digest, ...withoutDigest } = item;
      return withoutDigest;
    }),
  };
  assert.throws(() =>
    validateSkillHandoff(
      { ...unbound, fromId: 'pui-package-budget', nextSkillId: null },
      registry,
      { priorHandoff: unbound }
    )
  );
});

test('the actual v2 resolver admits numeric validation and rejects old-evidence review shortcuts', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'pui-budget-v2-'));
  const file = path.join(directory, 'handoff.json');
  const priorFile = path.join(directory, 'received.json');
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
      { cwd: root, encoding: 'utf8' }
    );
  };
  try {
    const valid = run(budget());
    assert.equal(valid.status, 0, valid.stderr);
    assert.equal(JSON.parse(valid.stdout).skill.id, 'pui-validate');
    const rejected = run({ ...budget(), nextSkillId: 'pui-review' });
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /pui-package-budget must continue through one of: pui-validate/);
    const received = receivedBudget();
    const blocked = {
      ...received,
      fromId: 'pui-package-budget',
      nextSkillId: null,
      notes: [
        'Canonical provenance is incomplete; no numeric edit. Refresh candidate measurements.',
      ],
    };
    assert.equal(run(blocked).status, 1);
    const unchanged = run(blocked, received);
    assert.equal(unchanged.status, 0, unchanged.stderr);
    assert.equal(JSON.parse(unchanged.stdout).terminal, true);
    assert.equal(run({ ...budget(), nextSkillId: null }, received).status, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('review interruption stays read-only while the numeric leaf cannot manufacture that route', () => {
  const interrupted = {
    ...budget(),
    fromId: 'pui-review',
    nextSkillId: 'pui-ci',
    outcome: 'interrupted',
    artifacts: [
      ...budget().artifacts,
      artifact('repository-snapshot'),
      artifact('workflow-snapshot'),
    ],
    interruption: {
      reason: 'Canonical CI requires diagnosis before review can finish.',
      pendingScope: ['numeric package-budget transaction'],
      pendingFindingIds: ['BUDGET-CI'],
      resumeSkillId: 'pui-review',
    },
  };
  assert.equal(structural(interrupted), true, JSON.stringify(structural.errors));
  assert.equal(validateSkillHandoff(interrupted, registry).nextSkill.id, 'pui-ci');
  assert.equal(
    validateSkillHandoff({ ...interrupted, nextSkillId: null }, registry).nextSkill,
    null
  );
  assert.throws(
    () => validateSkillHandoff({ ...interrupted, nextSkillId: 'pui-package-budget' }, registry),
    /interruption destination is not admitted/
  );
  assert.throws(
    () =>
      validateSkillHandoff(
        {
          ...interrupted,
          fromId: 'pui-package-budget',
          interruption: { ...interrupted.interruption, resumeSkillId: 'pui-package-budget' },
        },
        registry
      ),
    /source leaf does not admit interruption/
  );
});
