import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import {
  loadSkillRegistry,
  validateSkillHandoff,
  getHandoffArtifacts,
  requireCompletedHandoff,
} from '../skill-registry.mjs';
import { resumeSkillHandoff } from '../resume-skill.mjs';
const registry = loadSkillRegistry();
const schema = JSON.parse(
  fs.readFileSync(
    new URL(
      '../../../internal/agent-operations/schemas/skill-handoff.schema.json',
      import.meta.url
    ),
    'utf8'
  )
);
const structural = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
const sha = 'a'.repeat(40),
  digest = 'b'.repeat(64);
const binding = {
  repositoryId: 'github.com:Proto-UI/Proto-UI',
  scopeId: 'skills-813-814',
  headSha: sha,
  reviewInputDigest: digest,
};
const a = (type, reference = 'fixture:' + type, fields = {}) => ({ type, reference, ...fields });
function base(o = {}) {
  return {
    schemaVersion: 2,
    kind: 'proto-ui.skill-handoff',
    entrypoint: 'development',
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    fromId: 'pui-spec',
    nextSkillId: 'pui-validate',
    outcome: 'completed',
    binding,
    artifacts: [a('authority-map'), a('candidate-change'), a('evidence-report')],
    humanGates: [],
    notes: [],
    ...o,
  };
}
function interrupted(o = {}) {
  return base({
    fromId: 'pui-review',
    nextSkillId: 'pui-ci',
    outcome: 'interrupted',
    artifacts: [
      a('authority-map'),
      a('candidate-change'),
      a('evidence-report', 'fixture:prior', { revision: sha, result: 'partial' }),
      a('review-input', 'fixture:old-input', { digest: 'sha256:' + digest, revision: sha }),
      a('repository-snapshot'),
      a('workflow-snapshot'),
    ],
    interruption: {
      reason: 'Exact-head CI failure',
      pendingScope: ['scripts/agent-operations/skill-registry.mjs'],
      pendingFindingIds: ['CI-1'],
      resumeSkillId: 'pui-review',
    },
    ...o,
  });
}
function accepted(h, priorHandoff = null) {
  assert.equal(structural(h), true, JSON.stringify(structural.errors));
  return validateSkillHandoff(h, registry, { priorHandoff });
}
test('completed v1 remains compatible; completed v2 still requires producer output', () => {
  const h = base();
  assert.equal(accepted(h).nextSkill.id, 'pui-validate');
  const { outcome, binding, ...v1 } = h;
  v1.schemaVersion = 1;
  assert.equal(accepted(v1).nextSkill.id, 'pui-validate');
  assert.throws(
    () => validateSkillHandoff(base({ fromId: 'pui-review', nextSkillId: null })),
    /review-packet/
  );
  assert.throws(
    () =>
      validateSkillHandoff({
        ...v1,
        artifacts: [...v1.artifacts, a('evidence-report', 'fixture:second')],
      }),
    /duplicates type/
  );
});
test('v1 and v2 require a content-bound identity record and keep it singleton', () => {
  const current = base({
    fromId: 'pui-agent-identify',
    nextSkillId: null,
    artifacts: [
      a('request-context'),
      a('modeltrace-record', 'fixture:current-model', { digest: 'sha256:' + digest }),
    ],
  });
  const { outcome, binding, ...legacy } = current;
  legacy.schemaVersion = 1;
  for (const handoff of [legacy, current]) {
    assert.equal(accepted(handoff).nextSkill, null);
    for (const value of [undefined, digest]) {
      const unbound = structuredClone(handoff);
      const record = unbound.artifacts.find((artifact) => artifact.type === 'modeltrace-record');
      delete record.digest;
      if (value !== undefined) record.digest = value;
      assert.equal(structural(unbound), false);
      assert.throws(() => validateSkillHandoff(unbound, registry));
    }
    assert.throws(
      () =>
        validateSkillHandoff({
          ...handoff,
          artifacts: [
            ...handoff.artifacts,
            a('modeltrace-record', 'fixture:other-model', { digest: 'sha256:' + digest }),
          ],
        }),
      /duplicates type/
    );
  }
  assert.equal(
    structural({
      ...current,
      artifacts: [
        ...current.artifacts,
        a('modeltrace-record', 'fixture:other-model', { digest: 'sha256:' + digest }),
      ],
    }),
    false
  );
});
test('interruption admits exactly one read-only CI leaf or truthful terminal, never mutation', () => {
  assert.equal(accepted(interrupted()).nextSkill.id, 'pui-ci');
  assert.equal(accepted(interrupted({ nextSkillId: null })).nextSkill, null);
  assert.throws(() => requireCompletedHandoff(interrupted()), /cannot supply completed/);
  for (const nextSkillId of [
    'pui-integrate',
    'pui-collaborate',
    'pui-review',
    ['pui-ci', 'pui-validate'],
  ]) {
    const h = interrupted({ nextSkillId });
    assert.equal(structural(h), false);
    assert.throws(() => validateSkillHandoff(h));
  }
  assert.throws(
    () =>
      validateSkillHandoff(
        interrupted({
          artifacts: interrupted().artifacts.filter((a) => a.type !== 'workflow-snapshot'),
        })
      ),
    /workflow-snapshot/
  );
  assert.throws(
    () => validateSkillHandoff(interrupted({ binding: { ...binding, reviewInputDigest: null } })),
    /exact input binding/
  );
});
test('multiple materials retain scope, digest, revision and non-green results', () => {
  const materials = [
    a('candidate-change', 'fixture:second', {
      scopeId: binding.scopeId,
      repositoryId: binding.repositoryId,
      revision: sha,
      digest: 'sha256:' + digest,
    }),
    a('evidence-report', 'fixture:failed', { result: 'failed' }),
    a('evidence-report', 'fixture:unrun', { result: 'not-run' }),
  ];
  const h = base({ artifacts: [...base().artifacts, ...materials] });
  assert.equal(accepted(h).nextSkill.id, 'pui-validate');
  assert.deepEqual(getHandoffArtifacts(h, 'candidate-change'), [h.artifacts[1], materials[0]]);
  assert.equal(getHandoffArtifacts(h, 'evidence-report')[2].result, 'not-run');
});
test('singleton rules agree with schema; relational duplicate identities and cross-scope reject', () => {
  const singleton = base({
    artifacts: [
      ...base().artifacts,
      a('mutation-authorization', 'fixture:one'),
      a('mutation-authorization', 'fixture:two'),
    ],
  });
  assert.equal(structural(singleton), false);
  assert.throws(() => validateSkillHandoff(singleton), /duplicates type/);
  const exact = base({ artifacts: [...base().artifacts, a('candidate-change')] });
  assert.equal(structural(exact), false);
  assert.throws(() => validateSkillHandoff(exact), /duplicates type\/reference/);
  assert.throws(
    () =>
      validateSkillHandoff(
        base({
          artifacts: [
            ...base().artifacts,
            a('candidate-change', 'fixture:candidate-change', { revision: sha }),
          ],
        })
      ),
    /duplicates type\/reference/
  );
  for (const fields of [{ scopeId: 'foreign' }, { repositoryId: 'github.com:other/repo' }])
    assert.throws(
      () =>
        validateSkillHandoff(
          base({ artifacts: [...base().artifacts, a('candidate-change', 'fixture:cross', fields)] })
        ),
      /mismatch/
    );
  for (const repositoryId of [
    'githubXcom:Proto-UI/Proto-UI',
    'github.com:bad space/repo',
    'github.com:/repo',
  ]) {
    const h = base({ binding: { ...binding, repositoryId } });
    assert.equal(structural(h), false);
    assert.throws(() => validateSkillHandoff(h));
  }
});
test('mode/source drift, recursion, missing prerequisites and pending autonomous gates reject', () => {
  for (const h of [
    base({ executionMode: 'autonomous' }),
    base({ entrypoint: 'unknown' }),
    base({ nextSkillId: 'pui-spec' }),
    base({ artifacts: [a('candidate-change')] }),
    interrupted({
      executionMode: 'autonomous',
      executionModeSource: 'schedule',
      humanGates: ['unresolved-product-direction'],
    }),
  ])
    assert.throws(() => validateSkillHandoff(h));
  assert.equal(
    accepted(
      interrupted({
        executionMode: 'autonomous',
        executionModeSource: 'schedule',
        humanGates: ['unresolved-product-direction'],
        nextSkillId: null,
      })
    ).nextSkill,
    null
  );
});
function resumeArgs() {
  const prior = interrupted();
  const currentBinding = { ...binding, headSha: 'c'.repeat(40), reviewInputDigest: 'd'.repeat(64) };
  return {
    interrupted: prior,
    interruptedReference: 'fixture:interruption',
    continuation: base({
      fromId: 'pui-ci',
      nextSkillId: null,
      binding: currentBinding,
      artifacts: [a('ci-report', 'fixture:ci', { result: 'failed' })],
    }),
    currentArtifacts: [
      a('review-input', 'fixture:current', {
        revision: currentBinding.headSha,
        digest: 'sha256:' + currentBinding.reviewInputDigest,
      }),
      a('candidate-change', 'fixture:repair', {
        revision: currentBinding.headSha,
        digest: 'sha256:' + 'd'.repeat(64),
      }),
      a('evidence-report', 'fixture:fixed', {
        revision: currentBinding.headSha,
        result: 'passed',
        digest: 'sha256:' + 'e'.repeat(64),
      }),
    ],
  };
}
test('resume retains prior partial evidence and pending findings, refreshes head/input and returns original leaf', () => {
  const h = resumeSkillHandoff(resumeArgs(), registry);
  assert.equal(accepted(h).nextSkill.id, 'pui-review');
  assert.deepEqual(h.resume.pendingFindingIds, ['CI-1']);
  assert.equal(
    h.artifacts.some((a) => a.type === 'review-packet'),
    false
  );
  assert.equal(h.artifacts.find((a) => a.reference === 'fixture:prior').result, 'partial');
  assert.equal(h.artifacts.find((a) => a.type === 'ci-report').result, 'failed');
  assert.equal(h.artifacts.find((a) => a.type === 'prior-review-input').revision, sha);
  assert.equal(h.binding.headSha, 'c'.repeat(40));
  const unbound = structuredClone(h);
  unbound.artifacts = unbound.artifacts.filter((a) => a.type !== 'interruption-receipt');
  assert.throws(() => validateSkillHandoff(unbound), /bound interruption receipt/);
  const empty = structuredClone(h);
  empty.resume.pendingFindingIds = [''];
  assert.throws(() => validateSkillHandoff(empty), /pending work is invalid/);
});
test('resume rejects mode/scope drift, missing fresh input and injected approval', () => {
  for (const mutate of [
    (x) => (x.continuation.executionModeSource = 'active-human-loop'),
    (x) => (x.continuation.binding = { ...x.continuation.binding, scopeId: 'other' }),
    (x) => (x.currentArtifacts = []),
    (x) => x.currentArtifacts.push(a('review-packet')),
  ]) {
    const x = resumeArgs();
    mutate(x);
    assert.throws(() => resumeSkillHandoff(x, registry));
  }
});

test('resume cannot skip the specifically routed diagnostic producer', () => {
  const x = resumeArgs();
  x.continuation = base({
    fromId: 'pui-validate',
    nextSkillId: null,
    binding: x.continuation.binding,
  });
  assert.throws(() => resumeSkillHandoff(x, registry), /routed|continuation/);
});
test('interrupted review requires its auditable exact-head input artifact', () => {
  for (const mutate of [
    (h) => (h.artifacts = h.artifacts.filter((a) => a.type !== 'review-input')),
    (h) => (h.artifacts.find((a) => a.type === 'review-input').revision = 'e'.repeat(40)),
    (h) => (h.artifacts.find((a) => a.type === 'review-input').digest = 'sha256:' + 'e'.repeat(64)),
  ]) {
    const h = interrupted();
    mutate(h);
    assert.throws(() => validateSkillHandoff(h), /input/);
  }
});

test('resume preserves a routed diagnose/repair/validate chain without flattening away provenance', () => {
  const x = resumeArgs(),
    current = x.continuation.binding,
    review = x.currentArtifacts.find((a) => a.type === 'review-input');
  const authority = a('authority-map'),
    semantic = a('semantic-authorization');
  const ci = base({
    fromId: 'pui-ci',
    nextSkillId: 'pui-spec',
    binding,
    artifacts: [a('ci-report', 'fixture:diagnosis', { result: 'failed' }), authority, semantic],
  });
  const repair = base({
    fromId: 'pui-spec',
    nextSkillId: 'pui-validate',
    binding: current,
    artifacts: [
      authority,
      semantic,
      a('candidate-change', 'fixture:repair', {
        revision: current.headSha,
        digest: 'sha256:' + 'd'.repeat(64),
      }),
    ],
  });
  const validation = base({
    fromId: 'pui-validate',
    nextSkillId: 'pui-review',
    binding: current,
    artifacts: [
      authority,
      repair.artifacts[2],
      a('evidence-report', 'fixture:fixed', {
        revision: current.headSha,
        result: 'passed',
        digest: 'sha256:' + 'e'.repeat(64),
      }),
      review,
    ],
  });
  x.continuation = [ci, repair, validation];
  const result = resumeSkillHandoff(x, registry);
  assert.equal(accepted(result, repair).nextSkill.id, 'pui-review');
  assert.equal(result.fromId, 'pui-validate');
  assert.equal(result.artifacts.filter((a) => a.reference === 'fixture:repair').length, 1);
  assert.equal(
    result.artifacts.some((a) => a.reference === 'fixture:diagnosis' && a.result === 'failed'),
    true
  );
  assert.equal(
    result.artifacts.some((a) => a.reference === 'fixture:prior' && a.result === 'partial'),
    true
  );
  const skipped = structuredClone(x);
  skipped.continuation = [ci, validation];
  assert.throws(() => resumeSkillHandoff(skipped, registry), /skips a routed leaf/);
});

test('resume strips mutation and standing authorization artifacts from interrupted and every continuation input', () => {
  for (const location of ['interrupted', 'continuation']) {
    const x = resumeArgs();
    x[location].artifacts.push(
      a('mutation-authorization', 'fixture:injected-mutation'),
      a('standing-user-authorization', 'fixture:injected-standing')
    );
    const result = resumeSkillHandoff(x, registry);
    assert.equal(
      result.artifacts.some((a) =>
        ['mutation-authorization', 'standing-user-authorization'].includes(a.type)
      ),
      false
    );
    assert.equal(accepted(result).nextSkill.id, 'pui-review');
  }
});

test('resume retains validation enrichment of an optional candidate binding', () => {
  const x = resumeArgs(),
    current = x.continuation.binding,
    review = x.currentArtifacts.find((a) => a.type === 'review-input');
  const authority = a('authority-map'),
    semantic = a('semantic-authorization');
  const ci = base({
    fromId: 'pui-ci',
    nextSkillId: 'pui-spec',
    binding,
    artifacts: [a('ci-report', 'fixture:diagnosis', { result: 'failed' }), authority, semantic],
  });
  const repair = base({
    fromId: 'pui-spec',
    nextSkillId: 'pui-validate',
    binding: current,
    artifacts: [
      authority,
      semantic,
      a('candidate-change', 'fixture:repair', {
        revision: current.headSha,
        digest: 'sha256:' + 'd'.repeat(64),
      }),
    ],
  });
  const validation = base({
    fromId: 'pui-validate',
    nextSkillId: 'pui-review',
    binding: current,
    artifacts: [
      authority,
      repair.artifacts[2],
      a('evidence-report', 'fixture:fixed', {
        revision: current.headSha,
        result: 'passed',
        digest: 'sha256:' + 'e'.repeat(64),
      }),
      review,
    ],
  });
  validation.artifacts[1] = { ...validation.artifacts[1] };
  delete repair.artifacts[2].digest;
  delete repair.artifacts[2].revision;
  x.continuation = [ci, repair, validation];
  const result = resumeSkillHandoff(x, registry);
  assert.equal(accepted(result, repair).nextSkill.id, 'pui-review');
  assert.equal(result.fromId, 'pui-validate');
  assert.equal(result.artifacts.filter((a) => a.reference === 'fixture:repair').length, 1);
  assert.equal(
    result.artifacts.some((a) => a.reference === 'fixture:diagnosis' && a.result === 'failed'),
    true
  );
  assert.equal(
    result.artifacts.some((a) => a.reference === 'fixture:prior' && a.result === 'partial'),
    true
  );
  for (const bindAtRepair of [false, true]) {
    const reusedHistory = structuredClone(x);
    const historical = reusedHistory.interrupted.artifacts.find(
      (a) => a.type === 'candidate-change'
    );
    historical.reference = 'fixture:repair';
    if (bindAtRepair) reusedHistory.continuation[1].artifacts[2] = { ...validation.artifacts[1] };
    assert.throws(() => resumeSkillHandoff(reusedHistory, registry), /conflicting provenance/);
  }
  const refreshReuse = resumeArgs();
  refreshReuse.currentArtifacts.find((a) => a.type === 'candidate-change').reference =
    refreshReuse.interrupted.artifacts.find((a) => a.type === 'candidate-change').reference;
  assert.throws(() => resumeSkillHandoff(refreshReuse, registry), /conflicting provenance/);
  const skipped = structuredClone(x);
  skipped.continuation = [ci, validation];
  assert.throws(() => resumeSkillHandoff(skipped, registry), /skips a routed leaf/);
});
