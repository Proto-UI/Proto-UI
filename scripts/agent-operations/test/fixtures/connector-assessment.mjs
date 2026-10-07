import {
  computeChallengeDigest,
  createCapabilityResponseTemplate,
  deriveSelfAssessmentResult,
  loadCapabilityPolicy,
  loadCapabilityRubric,
} from '../../assessment-runtime.mjs';
const policy = loadCapabilityPolicy(
  new URL('../../../../internal/agent-operations/capability-policy.yaml', import.meta.url)
);
const rubric = loadCapabilityRubric(
  new URL('../../../../internal/agent-operations/capability-rubric.yaml', import.meta.url)
);
const subject = `session:${'b'.repeat(64)}`;
function makeChallenge(now) {
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
    subject: { assessmentSessionId: subject },
    scope: {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
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
      selfAssessmentCeiling: 'C4',
      externalEvaluationRequired: false,
    },
  };
  challenge.challengeDigest = computeChallengeDigest(challenge);
  return challenge;
}

function makeResponse(challenge, now) {
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

export function createConnectorAssessment() {
  const now = Date.now();
  const challenge = makeChallenge(now);
  return deriveSelfAssessmentResult({
    challenge,
    response: makeResponse(challenge, now),
    evaluation: makeEvaluation(4),
    rubric,
    policy,
  });
}

export const assessment = createConnectorAssessment();
export const assessmentSnapshot = { ...assessment.scope, rubricDigest: rubric.__digest };
