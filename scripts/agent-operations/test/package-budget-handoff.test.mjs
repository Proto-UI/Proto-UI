import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  evaluateSkillEligibility,
  loadSkillRegistry,
  resolveSkill,
  validateSkillHandoff,
} from '../skill-registry.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const required = [
  'capability-envelope',
  'authority-map',
  'candidate-change',
  'evidence-report',
  'implementation-authorization',
];
const artifact = (type) => ({
  type,
  reference: `file:///evidence/package-budget/${type}.json`,
  digest: `sha256:${'a'.repeat(64)}`,
});
const incoming = () => ({
  schemaVersion: 1,
  kind: 'proto-ui.skill-handoff',
  entrypoint: 'development',
  executionMode: 'human-assisted',
  executionModeSource: 'current-user',
  fromId: 'pui-dev',
  nextSkillId: 'pui-package-budget',
  artifacts: required.map(artifact),
  humanGates: [],
  notes: [],
});

test('the actual resolver CLI loads only the package-budget leaf for human-directed numeric work', () => {
  const result = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'scripts/agent-operations/resolve-skill.mjs',
        'pui-package-budget',
        '--mode',
        'human-assisted',
        '--mode-source',
        'current-user',
      ],
      { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
  );
  assert.equal(result.blocked, false);
  assert.equal(result.skill.id, 'pui-package-budget');
  assert.equal(result.skill.loadPath, '.agents/skills/pui-package-budget/SKILL.md');
});

test('numeric entry rejects each missing authority, measurement or implementation input', () => {
  const registry = loadSkillRegistry({ root });
  const handoff = incoming();
  assert.equal(validateSkillHandoff(handoff, registry).nextSkill.id, 'pui-package-budget');
  for (const type of required) {
    assert.throws(
      () =>
        validateSkillHandoff(
          {
            ...handoff,
            artifacts: handoff.artifacts.filter((item) => item.type !== type),
          },
          registry
        ),
      new RegExp(`lacks artifact required by pui-package-budget: ${type}`)
    );
  }
});

test('numeric entry requires a digest-bound candidate without changing other leaves', () => {
  const registry = loadSkillRegistry({ root });
  const handoff = incoming();
  assert.equal(validateSkillHandoff(handoff, registry).nextSkill.id, 'pui-package-budget');
  const digestless = {
    ...handoff,
    artifacts: handoff.artifacts.map((item) => {
      if (item.type !== 'candidate-change') return item;
      const { digest, ...withoutDigest } = item;
      return withoutDigest;
    }),
  };
  assert.throws(() => validateSkillHandoff(digestless, registry));
  assert.equal(
    validateSkillHandoff({ ...digestless, nextSkillId: 'pui-validate' }, registry).nextSkill.id,
    'pui-validate'
  );
});

test('a governance observation does not become numeric mutation authority', () => {
  const registry = loadSkillRegistry({ root });
  const governance = registry.byId.get('pui-govern');
  const report = {
    ...incoming(),
    fromId: governance.id,
    artifacts: [...governance.requires, ...governance.produces].map(artifact),
  };
  assert.throws(() => validateSkillHandoff(report, registry), /lacks artifact required/);
  const authorized = { ...report, artifacts: [...report.artifacts, ...incoming().artifacts] };
  assert.equal(validateSkillHandoff(authorized, registry).nextSkill.id, 'pui-package-budget');
  assert.equal(governance.mutation, 'none');
});

test('numeric candidates refresh existing validation evidence before independent review', () => {
  const registry = loadSkillRegistry({ root });
  const leaf = resolveSkill('pui-package-budget', registry);
  const input = incoming();
  const candidate = {
    ...input,
    fromId: leaf.id,
    nextSkillId: 'pui-validate',
    artifacts: input.artifacts.map((item) =>
      item.type === 'candidate-change'
        ? {
            ...item,
            reference: 'file:///evidence/package-budget/numeric-candidate.json',
            digest: `sha256:${'c'.repeat(64)}`,
          }
        : item
    ),
  };
  assert.equal(validateSkillHandoff(candidate, registry).nextSkill.id, 'pui-validate');
  for (const output of leaf.produces) {
    assert.throws(
      () =>
        validateSkillHandoff(
          {
            ...candidate,
            artifacts: candidate.artifacts.filter((item) => item.type !== output),
          },
          registry
        ),
      new RegExp(`artifact.*${output}`)
    );
  }
  const finalEvidence = {
    ...artifact('evidence-report'),
    reference: 'file:///evidence/package-budget/final-candidate.json',
    digest: `sha256:${'b'.repeat(64)}`,
  };
  const review = {
    ...candidate,
    fromId: 'pui-validate',
    nextSkillId: 'pui-review',
    artifacts: [
      ...candidate.artifacts.filter((item) => item.type !== 'evidence-report'),
      finalEvidence,
      artifact('review-input'),
    ],
  };
  assert.equal(
    validateSkillHandoff(review, registry, { priorHandoff: candidate }).nextSkill.id,
    'pui-review'
  );
  for (const type of ['authority-map', 'evidence-report', 'review-input']) {
    assert.throws(
      () =>
        validateSkillHandoff(
          {
            ...review,
            artifacts: review.artifacts.filter((item) => item.type !== type),
          },
          registry
        ),
      type === 'evidence-report'
        ? /missing artifact produced by pui-validate: evidence-report/
        : new RegExp(`lacks artifact required by pui-review: ${type}`)
    );
  }
  assert.throws(
    () => validateSkillHandoff({ ...review, nextSkillId: 'pui-integrate' }, registry),
    /lacks artifact required by pui-integrate: review-packet/
  );
});

test('a validation repair can return to the numeric owner only with preserved measurements and authorization', () => {
  const registry = loadSkillRegistry({ root });
  const handoff = {
    ...incoming(),
    fromId: 'pui-validate',
    artifacts: incoming().artifacts,
  };
  assert.equal(validateSkillHandoff(handoff, registry).nextSkill.id, 'pui-package-budget');
  for (const type of ['evidence-report', 'implementation-authorization']) {
    assert.throws(
      () =>
        validateSkillHandoff(
          {
            ...handoff,
            artifacts: handoff.artifacts.filter((item) => item.type !== type),
          },
          registry
        ),
      type === 'evidence-report'
        ? /missing artifact produced by pui-validate: evidence-report/
        : new RegExp(`lacks artifact required by pui-package-budget: ${type}`)
    );
  }
});

test('the numeric leaf can honestly terminate before editing by retaining its measured candidate', () => {
  const registry = loadSkillRegistry({ root });
  const preparation = { ...incoming(), fromId: 'pui-validate' };
  assert.equal(validateSkillHandoff(preparation, registry).nextSkill.id, 'pui-package-budget');
  const blocked = {
    ...preparation,
    fromId: 'pui-package-budget',
    nextSkillId: null,
    notes: [
      'Canonical evidence became stale after related integration; no budget edit. Refresh the combined measurement before continuing.',
    ],
  };
  const result = validateSkillHandoff(blocked, registry, { priorHandoff: preparation });
  assert.equal(result.nextSkill, null);
  for (const notes of [[], [' \t\n ', '']]) {
    assert.throws(() =>
      validateSkillHandoff({ ...blocked, notes }, registry, { priorHandoff: preparation })
    );
  }
  assert.equal(
    validateSkillHandoff({ ...blocked, notes: ['', ...blocked.notes] }, registry, {
      priorHandoff: preparation,
    }).nextSkill,
    null
  );
  assert.throws(
    () =>
      validateSkillHandoff(
        {
          ...blocked,
          artifacts: blocked.artifacts.filter((item) => item.type !== 'candidate-change'),
        },
        registry
      ),
    /missing artifact produced by pui-package-budget: candidate-change/
  );
});

test('numeric autonomy preserves assessment ceilings and genuine attended decisions', () => {
  const registry = loadSkillRegistry({ root });
  const leaf = resolveSkill('pui-package-budget', registry);
  assert.equal(evaluateSkillEligibility(leaf, { executionMode: 'human-assisted' }).eligible, true);
  assert.equal(evaluateSkillEligibility(leaf, { executionMode: 'autonomous' }).eligible, false);
  const assessment = (band, classes = ['update-governed-package-budget']) => ({
    kind: 'proto-ui.agent-capability-self-result',
    validated: true,
    fresh: true,
    capability: { band, eligibleTaskClasses: classes },
  });
  for (const [selfAssessment, expected] of [
    [assessment('C1'), false],
    [assessment('C2', ['maintain-docs']), false],
    [{ ...assessment('C2'), fresh: false }, false],
    [assessment('C2'), true],
  ]) {
    assert.equal(
      evaluateSkillEligibility(leaf, { executionMode: 'autonomous', selfAssessment }).eligible,
      expected
    );
  }
  for (const gate of ['unresolved-product-direction', 'privileged-or-irreversible-operation']) {
    const gated = {
      ...incoming(),
      executionMode: 'autonomous',
      executionModeSource: 'governed-queue',
      humanGates: [gate],
    };
    assert.throws(() => validateSkillHandoff(gated, registry), /must stop/);
    assert.equal(validateSkillHandoff({ ...gated, nextSkillId: null }, registry).nextSkill, null);
  }
});
