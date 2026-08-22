import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  canonicalize,
  collectCommittedAssessmentBaseline,
  computeChallengeDigest,
  digestJson,
  loadCapabilityPolicy,
  verifyCapabilityAttestation,
  verifyTaskPostflight,
  verifyTaskProbe,
} from '../capability-security.mjs';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const policy = loadCapabilityPolicy(
  resolve(root, 'internal/agent-operations/capability-policy.yaml')
);
const now = Date.now();
const iso = (offset) => new Date(now + offset).toISOString();
const hex = (character) => character.repeat(64);
const gitSha = 'a'.repeat(40);
const subject = `sha256:${hex('b')}`;
const verifiedRuntimeProof = {
  status: 'verified',
  provider: 'security-test-runtime',
  proofDigest: hex('0'),
  verifiedAt: iso(-60_000),
  expiresAt: iso(3_600_000),
};
const mutationPolicy = {
  ...policy,
  runtimeSubjectProof: {
    ...policy.runtimeSubjectProof,
    externalVerifierAvailable: true,
    verificationAdapters: ['security-test-runtime'],
  },
};

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
    challengeId: `challenge:${hex('c')}`,
    subject: { agentKeyFingerprint: subject },
    scope: {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
      assessmentMode: 'independent',
      snapshotMode: 'committed-clean',
      baseSha: gitSha,
      treeSha: gitSha,
      worktreeDigest: hex('1'),
      catalogDigest: hex('2'),
      policyDigest: policy.__digest,
      generatorDigest: hex('4'),
      nonceDigest: hex('5'),
    },
    validity: { issuedAt: iso(-60_000), expiresAt: iso(600_000) },
    questions: questionIds.map((id) => ({
      id,
      dimensions: ['governance-safety'],
      prompt: `Security test prompt for ${id}`,
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
  return {
    schemaVersion: 1,
    kind: 'proto-ui.agent-capability-response',
    challengeId: challenge.challengeId,
    challengeDigest: challenge.challengeDigest,
    subject: { agentKeyFingerprint: subject },
    submittedAt: iso(0),
    answers: challenge.questions.map((question) => ({
      questionId: question.id,
      answer: `Bounded answer for ${question.id}`,
      evidence: [
        {
          source: 'repository',
          locator: `test:${question.id}`,
          observation: 'Observed test evidence',
        },
      ],
      unknowns: [],
      humanGates: [],
    })),
  };
}

function makeKeyMaterial(purposes = ['capability-attestation', 'task-probe']) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  return {
    privateKey,
    registry: {
      schemaVersion: 1,
      issuers: [
        {
          keyId: 'security-test-key',
          purposes,
          evaluatorIds: ['security-test'],
          publicKeySpkiBase64: publicKey.export({ format: 'der', type: 'spki' }).toString('base64'),
          status: 'active',
          notBefore: iso(-600_000),
          expiresAt: iso(3_600_000),
        },
      ],
    },
  };
}

function signArtifact(payload, privateKey) {
  return {
    payload,
    signature: {
      algorithm: 'Ed25519',
      keyId: 'security-test-key',
      canonicalization: 'RFC8785',
      value: sign(null, Buffer.from(canonicalize(payload)), privateKey).toString('base64'),
    },
  };
}

function makeAttestation({
  challenge,
  response,
  privateKey,
  score,
  band,
  taskClasses,
  runtimeAttestation = { status: 'unavailable' },
}) {
  const dimensions = Object.fromEntries(
    [
      'sourceAuthority',
      'relationTracing',
      'semanticReasoning',
      'verificationDesign',
      'governanceSafety',
      'epistemicDiscipline',
    ].map((key) => [key, { score, evidence: [`evidence:${key}`] }])
  );
  const payload = {
    schemaVersion: 1,
    kind: 'proto-ui.agent-capability-attestation',
    assessmentId: `assessment:${hex('d')}`,
    challenge: {
      challengeId: challenge.challengeId,
      challengeDigest: challenge.challengeDigest,
      nonceDigest: challenge.scope.nonceDigest,
      responseDigest: digestJson(response),
    },
    subject: { agentKeyFingerprint: subject, runtimeAttestation },
    scope: {
      repositoryId: challenge.scope.repositoryId,
      snapshotMode: challenge.scope.snapshotMode,
      baseSha: challenge.scope.baseSha,
      treeSha: challenge.scope.treeSha,
      worktreeDigest: challenge.scope.worktreeDigest,
      catalogDigest: challenge.scope.catalogDigest,
      policyDigest: challenge.scope.policyDigest,
      generatorDigest: challenge.scope.generatorDigest,
    },
    evaluation: {
      evaluatorId: 'security-test',
      evaluatorVersion: '1',
      rubricVersion: 'security-1',
      method: 'human-reviewed',
      dimensions,
      criticalFailures: [],
    },
    capability: {
      band,
      eligibleTaskClasses: taskClasses,
      forbiddenActionClasses: [...policy.alwaysHuman],
    },
    validity: {
      issuedAt: iso(-30_000),
      notBefore: iso(-30_000),
      expiresAt: iso(3_600_000),
      invalidationTriggers: [...policy.attestation.invalidateOn],
    },
  };
  return signArtifact(payload, privateKey);
}

function verifyAttestation(attestation, challenge, response, registry) {
  return verifyCapabilityAttestation({
    attestation,
    challenge,
    response,
    registry,
    policy,
    expectedSubject: subject,
    expectedRepositoryId: challenge.scope.repositoryId,
    now,
  });
}

function makeMutationScope({ operations = ['modify'] } = {}) {
  return {
    authorityAnchors: ['spec:authority'],
    acceptance: ['bounded acceptance'],
    exclusions: ['no integration'],
    affectedSurfaces: ['agent protocol'],
    allowedPaths: [{ path: 'internal/agent-operations', mode: 'tree' }],
    allowedOperations: operations,
    evidence: ['focused security tests'],
    stopConditions: ['authority contradiction'],
    humanGates: ['integration-decision'],
    ownershipDigest: hex('3'),
    linkedWorkDigest: hex('4'),
  };
}

function makeLeaf(overrides = {}) {
  return {
    id: 'pui-unclaim',
    taskClass: 'release-own-claim',
    minimumBand: 'C2',
    mutation: 'reversible-github-metadata',
    ...overrides,
  };
}

function makeSignedProbe({
  privateKey,
  verified,
  leaf = makeLeaf(),
  scope = makeMutationScope({ operations: ['external-github-metadata'] }),
  executionMode = 'attended-human',
}) {
  return signArtifact(
    {
      schemaVersion: 1,
      kind: 'proto-ui.agent-task-probe',
      probeId: `probe:${hex('1')}`,
      subject: { agentKeyFingerprint: subject },
      repository: {
        repositoryId: 'github.com:Proto-UI/Proto-UI',
        baseSha: gitSha,
        headSha: gitSha,
        treeSha: gitSha,
        worktreeDigest: hex('8'),
        diffDigest: hex('9'),
        entityGraphDigest: hex('a'),
      },
      task: {
        taskId: 'issue:bounded',
        updatedAt: iso(-10_000),
        leafId: leaf.id,
        taskClass: leaf.taskClass,
        mutation: leaf.mutation,
        risk: 'low',
        executionMode,
      },
      scope,
      authorization: {
        capabilityAssessmentId: verified.assessmentId,
        capabilityAttestationDigest: verified.attestationDigest,
        permissionSnapshotDigest: hex('6'),
        humanAuthorizationDigest: hex('7'),
      },
      validity: {
        issuedAt: iso(-5_000),
        notBefore: iso(-5_000),
        expiresAt: iso(60_000),
        singleUse: true,
      },
    },
    privateKey
  );
}

function expectedForProbe(probe) {
  return {
    taskId: probe.payload.task.taskId,
    taskUpdatedAt: probe.payload.task.updatedAt,
    leafId: probe.payload.task.leafId,
    taskClass: probe.payload.task.taskClass,
    mutation: probe.payload.task.mutation,
    scopeDigest: digestJson(probe.payload.scope),
    ...probe.payload.repository,
    permissionSnapshotDigest: probe.payload.authorization.permissionSnapshotDigest,
    humanAuthorizationDigest: probe.payload.authorization.humanAuthorizationDigest,
  };
}

test('rejects a self-signed C4 when the trusted issuer registry is empty', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const { privateKey } = makeKeyMaterial();
  const attestation = makeAttestation({
    challenge,
    response,
    privateKey,
    score: 4,
    band: 'C4',
    taskClasses: ['shape-semantic-decision'],
  });
  assert.throws(
    () => verifyAttestation(attestation, challenge, response, { schemaVersion: 1, issuers: [] }),
    /untrusted capability issuer/
  );
});

test('rejects a trusted signature that claims C4 for C1 scores', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const { privateKey, registry } = makeKeyMaterial();
  const attestation = makeAttestation({
    challenge,
    response,
    privateKey,
    score: 1,
    band: 'C4',
    taskClasses: ['shape-semantic-decision'],
  });
  assert.throws(
    () => verifyAttestation(attestation, challenge, response, registry),
    /does not match derived band C1/
  );
});

test('rejects all-zero scores as U0 rather than granting C1', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const { privateKey, registry } = makeKeyMaterial();
  const attestation = makeAttestation({
    challenge,
    response,
    privateKey,
    score: 0,
    band: 'C1',
    taskClasses: [],
  });
  assert.throws(
    () => verifyAttestation(attestation, challenge, response, registry),
    /do not qualify for C1/
  );
});

test('atomically consumes a task probe and rejects replay', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const { privateKey, registry } = makeKeyMaterial();
  const attestation = makeAttestation({
    challenge,
    response,
    privateKey,
    score: 2,
    band: 'C2',
    taskClasses: ['release-own-claim'],
    runtimeAttestation: verifiedRuntimeProof,
  });
  const verified = verifyAttestation(attestation, challenge, response, registry);
  const permissionSnapshotDigest = hex('6');
  const humanAuthorizationDigest = hex('7');
  const scope = makeMutationScope({ operations: ['external-github-metadata'] });
  const leaf = makeLeaf();
  const probe = signArtifact(
    {
      schemaVersion: 1,
      kind: 'proto-ui.agent-task-probe',
      probeId: `probe:${hex('e')}`,
      subject: { agentKeyFingerprint: subject },
      repository: {
        repositoryId: challenge.scope.repositoryId,
        baseSha: challenge.scope.baseSha,
        headSha: gitSha,
        treeSha: gitSha,
        worktreeDigest: hex('8'),
        diffDigest: hex('9'),
        entityGraphDigest: hex('a'),
      },
      task: {
        taskId: 'issue:123',
        updatedAt: iso(-10_000),
        leafId: leaf.id,
        taskClass: 'release-own-claim',
        mutation: leaf.mutation,
        risk: 'low',
        executionMode: 'attended-human',
      },
      scope,
      authorization: {
        capabilityAssessmentId: verified.assessmentId,
        capabilityAttestationDigest: verified.attestationDigest,
        permissionSnapshotDigest,
        humanAuthorizationDigest,
      },
      validity: {
        issuedAt: iso(-5_000),
        notBefore: iso(-5_000),
        expiresAt: iso(60_000),
        singleUse: true,
      },
    },
    privateKey
  );
  const expected = {
    taskId: 'issue:123',
    taskUpdatedAt: probe.payload.task.updatedAt,
    leafId: leaf.id,
    taskClass: 'release-own-claim',
    mutation: leaf.mutation,
    scopeDigest: digestJson(scope),
    ...probe.payload.repository,
    permissionSnapshotDigest,
    humanAuthorizationDigest,
  };
  const consumeDirectory = mkdtempSync(join(tmpdir(), 'pui-probe-consumption-'));
  try {
    const options = {
      probe,
      verifiedAttestation: verified,
      registry,
      policy: mutationPolicy,
      expected,
      leaf,
      verifiedRuntimeSubject: {
        verified: true,
        subject,
        provider: verifiedRuntimeProof.provider,
        proofDigest: verifiedRuntimeProof.proofDigest,
      },
      consumeDirectory,
      now,
    };
    assert.equal(verifyTaskProbe(options).probeId, probe.payload.probeId);
    assert.throws(() => verifyTaskProbe(options), /task probe replay detected/);
  } finally {
    rmSync(consumeDirectory, { recursive: true, force: true });
  }
});

test('rejects every automatic external mutation without a global consumer', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const { privateKey, registry } = makeKeyMaterial();
  const attestation = makeAttestation({
    challenge,
    response,
    privateKey,
    score: 4,
    band: 'C4',
    taskClasses: ['prepare-release-state'],
  });
  const verified = verifyAttestation(attestation, challenge, response, registry);
  const scope = makeMutationScope({ operations: ['external-github-metadata'] });
  const probe = signArtifact(
    {
      schemaVersion: 1,
      kind: 'proto-ui.agent-task-probe',
      probeId: `probe:${hex('f')}`,
      subject: { agentKeyFingerprint: subject },
      repository: {
        repositoryId: challenge.scope.repositoryId,
        baseSha: challenge.scope.baseSha,
        headSha: gitSha,
        treeSha: gitSha,
        worktreeDigest: hex('8'),
        diffDigest: hex('9'),
        entityGraphDigest: hex('a'),
      },
      task: {
        taskId: 'release:test',
        updatedAt: iso(-10_000),
        leafId: 'pui-release-prep',
        taskClass: 'prepare-release-state',
        mutation: 'feature-branch',
        risk: 'low',
        executionMode: 'automatic',
      },
      scope,
      authorization: {
        capabilityAssessmentId: verified.assessmentId,
        capabilityAttestationDigest: verified.attestationDigest,
        permissionSnapshotDigest: hex('6'),
        humanAuthorizationDigest: hex('7'),
      },
      validity: {
        issuedAt: iso(-5_000),
        notBefore: iso(-5_000),
        expiresAt: iso(60_000),
        singleUse: true,
      },
    },
    privateKey
  );
  assert.throws(
    () =>
      verifyTaskProbe({
        probe,
        verifiedAttestation: verified,
        registry,
        policy,
        expected: {},
        leaf: makeLeaf({
          id: 'pui-release-prep',
          taskClass: 'prepare-release-state',
          minimumBand: 'C4',
          mutation: 'feature-branch',
        }),
        consumeDirectory: 'unused',
        now,
      }),
    /automatic external mutation is unavailable/
  );
});

test('rejects a probe whose signed leaf differs from the selected registry leaf', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const { privateKey, registry } = makeKeyMaterial();
  const attestation = makeAttestation({
    challenge,
    response,
    privateKey,
    score: 2,
    band: 'C2',
    taskClasses: ['release-own-claim'],
    runtimeAttestation: verifiedRuntimeProof,
  });
  const verified = verifyAttestation(attestation, challenge, response, registry);
  const probe = makeSignedProbe({ privateKey, verified });
  assert.throws(
    () =>
      verifyTaskProbe({
        probe,
        verifiedAttestation: verified,
        registry,
        policy: mutationPolicy,
        expected: expectedForProbe(probe),
        leaf: makeLeaf({ id: 'pui-claim' }),
        verifiedRuntimeSubject: {
          verified: true,
          subject,
          provider: verifiedRuntimeProof.provider,
          proofDigest: verifiedRuntimeProof.proofDigest,
        },
        consumeDirectory: 'unused',
        now,
      }),
    /leaf does not match/
  );
});

test('denies mutation when runtime subject verification is unavailable', () => {
  const challenge = makeChallenge();
  const response = makeResponse(challenge);
  const { privateKey, registry } = makeKeyMaterial();
  const attestation = makeAttestation({
    challenge,
    response,
    privateKey,
    score: 2,
    band: 'C2',
    taskClasses: ['release-own-claim'],
  });
  const verified = verifyAttestation(attestation, challenge, response, registry);
  const probe = makeSignedProbe({ privateKey, verified });
  assert.throws(
    () =>
      verifyTaskProbe({
        probe,
        verifiedAttestation: verified,
        registry,
        policy,
        expected: expectedForProbe(probe),
        leaf: makeLeaf(),
        verifiedRuntimeSubject: null,
        consumeDirectory: 'unused',
        now,
      }),
    /runtime subject proof verification is unavailable/
  );
});

test('postflight rejects paths and operations outside the signed scope', () => {
  const probe = { payload: { scope: makeMutationScope() } };
  assert.deepEqual(
    verifyTaskPostflight({
      probe,
      changedPaths: ['internal/agent-operations/capability-policy.yaml'],
      operations: ['modify'],
    }),
    {
      valid: true,
      changedPaths: ['internal/agent-operations/capability-policy.yaml'],
      operations: ['modify'],
    }
  );
  assert.throws(
    () =>
      verifyTaskPostflight({
        probe,
        changedPaths: ['packages/runtime/src/index.ts'],
        operations: ['modify'],
      }),
    /outside probe scope/
  );
  assert.throws(
    () =>
      verifyTaskPostflight({
        probe,
        changedPaths: ['internal/agent-operations/capability-policy.yaml'],
        operations: ['delete'],
      }),
    /operation is outside probe scope/
  );
});

test('committed assessment baseline remains verifiable during dirty continuation', () => {
  const repository = mkdtempSync(join(tmpdir(), 'pui-attested-baseline-'));
  try {
    mkdirSync(join(repository, 'spec'), { recursive: true });
    mkdirSync(join(repository, 'internal/agent-operations'), { recursive: true });
    mkdirSync(join(repository, 'scripts/agent-operations'), { recursive: true });
    writeFileSync(join(repository, 'spec/entity.yaml'), 'id: test\n');
    writeFileSync(
      join(repository, 'internal/agent-operations/capability-policy.yaml'),
      'schemaVersion: 1\n'
    );
    writeFileSync(
      join(repository, 'scripts/agent-operations/create-capability-challenge.mjs'),
      'export {};\n'
    );
    execFileSync('git', ['init'], { cwd: repository });
    execFileSync('git', ['config', 'user.email', 'security-test@example.invalid'], {
      cwd: repository,
    });
    execFileSync('git', ['config', 'user.name', 'Security Test'], { cwd: repository });
    execFileSync('git', ['add', '.'], { cwd: repository });
    execFileSync('git', ['commit', '-m', 'baseline'], { cwd: repository });
    const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repository,
      encoding: 'utf8',
    }).trim();
    const before = collectCommittedAssessmentBaseline(repository, baseSha, {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
    });
    writeFileSync(join(repository, 'spec/entity.yaml'), 'id: changed\n');
    writeFileSync(join(repository, 'untracked.txt'), 'dirty\n');
    const during = collectCommittedAssessmentBaseline(repository, baseSha, {
      repositoryId: 'github.com:Proto-UI/Proto-UI',
    });
    assert.deepEqual(during, before);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
});
