import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  computeChallengeDigest,
  computeSelfAssessmentResultDigest,
  createCapabilityResponseTemplate,
  deriveSelfAssessmentResult,
  loadCapabilityPolicy,
  loadCapabilityRubric,
  validateCapabilityResponse,
} from '../capability-security.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const policy = loadCapabilityPolicy(
  resolve(root, 'internal/agent-operations/capability-policy.yaml')
);
const rubric = loadCapabilityRubric(
  resolve(root, 'internal/agent-operations/capability-rubric.yaml')
);
const subject = `sha256:${'b'.repeat(64)}`;
const now = Date.now();

function makeChallenge() {
  const questionIds = [
    'authority',
    'relations',
    'boundary',
    'validation',
    'governance',
    'permission',
  ];
  const challenge = {
    schemaVersion: 1,
    kind: 'proto-ui.agent-capability-challenge',
    challengeId: `challenge:${'c'.repeat(64)}`,
    subject: { agentKeyFingerprint: subject },
    scope: {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      assessmentMode: 'self-assessment',
      snapshotMode: 'worktree',
      baseSha: 'a'.repeat(40),
      treeSha: 'a'.repeat(40),
      worktreeDigest: '1'.repeat(64),
      catalogDigest: '2'.repeat(64),
      policyDigest: policy.__digest,
      generatorDigest: '4'.repeat(64),
      nonceDigest: '5'.repeat(64),
    },
    validity: {
      issuedAt: new Date(now - 60_000).toISOString(),
      expiresAt: new Date(now + 600_000).toISOString(),
    },
    questions: questionIds.map((id) => ({
      id,
      dimensions: ['epistemic-discipline'],
      prompt: `Bounded dynamic assessment prompt for ${id}`,
      requiredEvidence: ['path', 'anchor', 'command', 'unknown'],
    })),
    responseContract: {
      format: 'json',
      schema: 'internal/agent-operations/schemas/capability-response.schema.json',
      requiredPerQuestion: ['answer', 'evidence', 'unknowns', 'humanGates'],
      selfAssessmentCeiling: 'C1',
      independentEvaluationRequiredAbove: 'C1',
    },
  };
  challenge.challengeDigest = computeChallengeDigest(challenge);
  return challenge;
}

function makeResponse(challenge) {
  const response = createCapabilityResponseTemplate(challenge);
  response.submittedAt = new Date(now).toISOString();
  for (const answer of response.answers) {
    answer.answer = `Bounded conclusion for ${answer.questionId}`;
    answer.evidence = [
      {
        source: 'repository',
        locator: `assessment:${answer.questionId}`,
        observation: 'Located observation for deterministic validation',
      },
    ];
  }
  return response;
}

function makeEvaluation(score, criticalFailures = []) {
  return {
    dimensions: Object.fromEntries(
      Object.entries(rubric.dimensions).map(([key, dimension]) => [
        key,
        {
          score,
          rationale: `Self-scored against ${key} criterion`,
          evidenceQuestionIds: [...dimension.questionIds],
        },
      ])
    ),
    criticalFailures,
  };
}

test('response template is challenge-bound and intentionally incomplete', () => {
  const challenge = makeChallenge();
  const template = createCapabilityResponseTemplate(challenge);
  assert.equal(template.challengeDigest, challenge.challengeDigest);
  assert.equal(template.answers.length, 6);
  assert.throws(() => validateCapabilityResponse(template, challenge), /submittedAt/);
});

test('self scores derive only unsigned U0 or C1 with no mutation ceiling', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const u0 = deriveSelfAssessmentResult({
    challenge,
    response,
    evaluation: makeEvaluation(0),
    rubric,
    policy,
  });
  assert.equal(u0.capability.band, 'U0');
  const capped = deriveSelfAssessmentResult({
    challenge,
    response,
    evaluation: makeEvaluation(4, ['hidden-uncertainty']),
    rubric,
    policy,
  });
  assert.equal(capped.capability.band, 'C1');
  assert.equal(capped.capability.mutationCeiling, 'none');
  assert.equal(capped.trust.authorizesMutation, false);
  assert.equal(capped.trust.substitutesForTrustedAttestation, false);
  assert.equal(computeSelfAssessmentResultDigest(capped), capped.resultDigest);
  capped.evaluation.dimensions.sourceAuthority.score = 0;
  assert.notEqual(computeSelfAssessmentResultDigest(capped), capped.resultDigest);
});

test('bundle stdin validates a response and derives a deterministic self result', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const evaluation = makeEvaluation(1);
  const validation = spawnSync(
    process.execPath,
    ['scripts/agent-operations/validate-capability-response.mjs', '--bundle', '-'],
    { cwd: root, input: JSON.stringify({ challenge, response }), encoding: 'utf8' }
  );
  assert.equal(validation.status, 0, validation.stderr);
  assert.equal(JSON.parse(validation.stdout).valid, true);

  const args = ['scripts/agent-operations/derive-self-assessment.mjs', '--bundle', '-'];
  const input = JSON.stringify({ challenge, response, evaluation });
  const first = spawnSync(process.execPath, args, { cwd: root, input, encoding: 'utf8' });
  const second = spawnSync(process.execPath, args, { cwd: root, input, encoding: 'utf8' });
  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  assert.equal(first.stdout, second.stdout);
  assert.equal(JSON.parse(first.stdout).capability.band, 'C1');
});

test('bundle file input follows the same deterministic validation path', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const directory = mkdtempSync(join(tmpdir(), 'pui-assessment-bundle-'));
  const bundlePath = join(directory, 'bundle.json');
  try {
    writeFileSync(bundlePath, JSON.stringify({ challenge, response }));
    const validation = spawnSync(
      process.execPath,
      ['scripts/agent-operations/validate-capability-response.mjs', '--bundle', bundlePath],
      { cwd: root, encoding: 'utf8' }
    );
    assert.equal(validation.status, 0, validation.stderr);
    assert.equal(JSON.parse(validation.stdout).valid, true);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('self evaluation rejects an uncataloged critical failure', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  assert.throws(
    () =>
      deriveSelfAssessmentResult({
        challenge,
        response,
        evaluation: makeEvaluation(4, ['not-a-real-failure']),
        rubric,
        policy,
      }),
    /unknown critical failure/
  );
});
