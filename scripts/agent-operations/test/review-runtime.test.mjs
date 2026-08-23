import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';
import {
  authorizeReviewSubmission,
  computeReviewInputDigest,
  decideReviewRun,
  evaluateReviewEligibility,
  inspectReviewRevision,
  reviewPacketKey,
  validateReviewInputSnapshot,
  validateReviewPacket,
  validateReviewPacketEligibility,
} from '../review-runtime.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const policy = parseYaml(
  readFileSync(path.join(root, 'internal/agent-operations/capability-policy.yaml'), 'utf8')
);
const sha = (letter) => letter.repeat(40);
const digest = (letter) => letter.repeat(64);

function reviewInput(overrides = {}) {
  return {
    schemaVersion: 1,
    kind: 'proto-ui.review-input',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 487,
    baseSha: sha('a'),
    headSha: sha('b'),
    pullRequestBody: 'Bounded review target',
    commits: [{ sha: sha('b'), message: 'Bounded change' }],
    replies: [],
    threads: [],
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T00:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
      },
    ],
    externalEvidence: [],
    ...overrides,
  };
}

function packet(overrides = {}, input = reviewInput()) {
  return {
    schemaVersion: 1,
    kind: 'proto-ui.review-packet',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 487,
    baseSha: sha('a'),
    headSha: sha('b'),
    reviewInputDigest: computeReviewInputDigest(input),
    observedAt: '2026-08-23T00:00:00.000Z',
    reviewClass: 'review-governed-implementation-slice',
    scope: ['agent operations'],
    affectedEntities: ['governance:contributor-agent'],
    affectedSurfaces: ['scripts', 'docs'],
    findings: [],
    validation: {
      commands: [
        { command: 'pnpm check:agent-operations', exitCode: 0, result: '26 tests passed' },
      ],
      checksNotRun: [],
    },
    reconciliation: {
      priorReviewedHeadSha: null,
      resolvedFindingIds: [],
      openFindingIds: [],
      newFindingIds: [],
    },
    limitations: ['Review depth is limited without a fresh local assessment'],
    unknowns: [],
    humanGates: ['pull-request-approval'],
    recommendedAction: 'ABSTAIN',
    ...overrides,
  };
}

function assessment(band, reviewClasses, { fresh = true, validated = true } = {}) {
  return {
    kind: 'proto-ui.agent-capability-self-result',
    fresh,
    validated,
    capability: { band, recommendedReviewClasses: reviewClasses },
  };
}

test('review packet binds revision and input state and supports incremental reconciliation', () => {
  const input = reviewInput();
  const original = packet({}, input);
  const key = reviewPacketKey(original, input);
  assert.equal(reviewPacketKey({ ...original }, input), key);
  assert.deepEqual(decideReviewRun(original, input, [key]), {
    shouldRun: false,
    duplicate: true,
    key,
  });

  const changedInput = reviewInput({ pullRequestBody: 'Bounded review target with a reply' });
  const newEvidence = packet({}, changedInput);
  assert.notEqual(reviewPacketKey(newEvidence, changedInput), key);
  assert.equal(decideReviewRun(newEvidence, changedInput, [key]).shouldRun, true);

  assert.deepEqual(inspectReviewRevision(original, input, sha('b')), {
    stale: false,
    incrementalRange: null,
    reconciliationRequired: false,
  });
  assert.deepEqual(inspectReviewRevision(original, input, sha('d'), sha('b')), {
    stale: true,
    incrementalRange: `${sha('b')}..${sha('d')}`,
    reconciliationRequired: true,
  });
  assert.equal(inspectReviewRevision(original, input, sha('b'), null, sha('c')).stale, true);
  assert.throws(
    () => reviewPacketKey({ ...original, executionMode: 'human-assisted' }, input),
    /unexpected/
  );
  assert.throws(
    () => validateReviewPacket({ ...original, reviewInputDigest: digest('d') }, input),
    /canonical input snapshot/
  );

  const reordered = reviewInput({
    commits: [
      { sha: sha('c'), message: 'Second' },
      { sha: sha('b'), message: 'First' },
    ],
  });
  const reversed = { ...reordered, commits: [...reordered.commits].reverse() };
  assert.equal(computeReviewInputDigest(reordered), computeReviewInputDigest(reversed));
  const reorderedKeys = Object.fromEntries(Object.entries(reordered).reverse());
  reorderedKeys.commits = reorderedKeys.commits.map((commit) => ({
    message: commit.message,
    sha: commit.sha,
  }));
  assert.equal(computeReviewInputDigest(reordered), computeReviewInputDigest(reorderedKeys));
  const tiedChecks = reviewInput({
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
        completedAt: '2026-08-23T00:01:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
      },
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T00:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
      },
    ],
  });
  assert.equal(
    computeReviewInputDigest(tiedChecks),
    computeReviewInputDigest({ ...tiedChecks, checks: [...tiedChecks.checks].reverse() })
  );
  assert.notEqual(
    computeReviewInputDigest(reordered),
    computeReviewInputDigest({ ...reordered, pullRequestBody: 'Changed body' })
  );
});

test('review packet requires real scope, evidence accounting, and finding reconciliation', () => {
  const finding = {
    id: 'F-1',
    severity: 'P1',
    confidence: 'high',
    file: 'scripts/example.mjs',
    line: 10,
    authority: 'AGENTS.md',
    observed: 'Observed drift',
    expected: 'Expected governed behavior',
    impact: 'Review result is misleading',
    fix: 'Restore the governed boundary',
  };
  const input = reviewInput();
  const valid = packet(
    {
      findings: [finding],
      reconciliation: {
        priorReviewedHeadSha: sha('9'),
        resolvedFindingIds: ['F-0'],
        openFindingIds: [],
        newFindingIds: ['F-1'],
      },
    },
    input
  );
  assert.equal(validateReviewPacket(valid, input), valid);
  assert.equal(validateReviewInputSnapshot(input), input);
  assert.throws(() => validateReviewPacket(packet({ scope: [] }, input), input), /scope/);
  assert.throws(
    () =>
      validateReviewPacket(
        packet({ validation: { commands: [], checksNotRun: [] } }, input),
        input
      ),
    /validation command/
  );
  const absentFinding = structuredClone(valid);
  absentFinding.reconciliation.newFindingIds = ['F-2'];
  assert.throws(() => validateReviewPacket(absentFinding, input), /absent current finding/);

  const absentOpenFinding = structuredClone(valid);
  absentOpenFinding.reconciliation.newFindingIds = [];
  absentOpenFinding.reconciliation.openFindingIds = ['F-2'];
  assert.throws(() => validateReviewPacket(absentOpenFinding, input), /absent current finding/);

  const unreconciledFinding = structuredClone(valid);
  unreconciledFinding.reconciliation.newFindingIds = [];
  assert.throws(() => validateReviewPacket(unreconciledFinding, input), /reconciled exactly once/);

  const stillCurrentResolvedFinding = structuredClone(valid);
  stillCurrentResolvedFinding.reconciliation.newFindingIds = [];
  stillCurrentResolvedFinding.reconciliation.resolvedFindingIds = ['F-1'];
  assert.throws(() => validateReviewPacket(stillCurrentResolvedFinding, input), /still references/);
});

test('human-assisted review remains open while autonomous review obeys the exact class ceiling', () => {
  const c1 = assessment('C1', ['review-facts-and-ci', 'review-docs-and-links']);
  assert.deepEqual(
    evaluateReviewEligibility({
      executionMode: 'human-assisted',
      selfAssessment: c1,
      reviewClass: 'review-cross-domain-semantics',
      policy,
    }),
    {
      eligible: true,
      reviewDepth: 'partial',
      maximumRecommendation: 'ABSTAIN',
      limitationRequired: true,
      approvalDecisionRequired: true,
    }
  );
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: c1,
      reviewClass: 'review-facts-and-ci',
      policy,
    }).eligible,
    true
  );
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: c1,
      reviewClass: 'review-tests',
      policy,
    }).eligible,
    false
  );
  const c2 = assessment('C2', [
    'review-facts-and-ci',
    'review-docs-and-links',
    'review-tests',
    'review-bounded-regression',
  ]);
  const bounded = evaluateReviewEligibility({
    executionMode: 'autonomous',
    selfAssessment: c2,
    reviewClass: 'review-bounded-regression',
    policy,
  });
  assert.equal(bounded.eligible, true);
  assert.equal(bounded.maximumRecommendation, 'REQUEST_CHANGES');
  assert.equal(bounded.approvalDecisionRequired, true);
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: { ...c2, fresh: false },
      reviewClass: 'review-bounded-regression',
      policy,
    }).eligible,
    false
  );

  const highClassPacket = packet({ reviewClass: 'review-cross-domain-semantics' });
  const c1HighClass = evaluateReviewEligibility({
    executionMode: 'autonomous',
    selfAssessment: c1,
    reviewClass: highClassPacket.reviewClass,
    policy,
  });
  assert.throws(
    () => validateReviewPacketEligibility(highClassPacket, c1HighClass, 'autonomous'),
    /exceeds the autonomous ceiling/
  );
  assert.throws(
    () =>
      validateReviewPacketEligibility(
        packet({ recommendedAction: 'REQUEST_CHANGES', limitations: [] }),
        evaluateReviewEligibility({
          executionMode: 'human-assisted',
          selfAssessment: null,
          reviewClass: 'review-governed-implementation-slice',
          policy,
        }),
        'human-assisted'
      ),
    /eligible maximum|limitation/
  );
});

test('review submission needs live authorization and never derives approval from assessment or CI', () => {
  const input = reviewInput();
  const base = {
    packet: packet({ recommendedAction: 'APPROVE' }, input),
    input,
    currentBaseSha: input.baseSha,
    currentHeadSha: input.headSha,
    executionMode: 'human-assisted',
    credentialCanReview: true,
    reviewer: 'agent',
    pullRequestAuthor: 'contributor',
    ciConclusion: 'success',
  };
  assert.equal(authorizeReviewSubmission({ ...base, explicitAuthorization: false }).allowed, false);
  assert.equal(
    authorizeReviewSubmission({ ...base, explicitAuthorization: true, credentialCanReview: false })
      .allowed,
    false
  );
  assert.equal(authorizeReviewSubmission({ ...base, explicitAuthorization: true }).allowed, false);
  assert.equal(
    authorizeReviewSubmission({
      ...base,
      explicitAuthorization: true,
      reviewer: 'contributor',
      pullRequestAuthor: 'contributor',
      packet: packet({ recommendedAction: 'REQUEST_CHANGES', limitations: [] }, input),
    }).allowed,
    false
  );
  const allowed = authorizeReviewSubmission({
    ...base,
    explicitAuthorization: true,
    ciConclusion: 'failure',
    packet: packet({ recommendedAction: 'COMMENT', limitations: [] }, input),
  });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.recommendedAction, 'COMMENT');
  const greenComment = authorizeReviewSubmission({
    ...base,
    explicitAuthorization: true,
    ciConclusion: 'success',
    packet: packet({ recommendedAction: 'COMMENT', limitations: [] }, input),
  });
  assert.equal(greenComment.recommendedAction, 'COMMENT');
  assert.equal(
    authorizeReviewSubmission({ ...base, executionMode: 'autonomous', explicitAuthorization: true })
      .allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission({
      ...base,
      packet: packet({ recommendedAction: 'COMMENT', limitations: [] }, input),
      currentHeadSha: sha('d'),
      explicitAuthorization: true,
    }).allowed,
    false
  );
});

test('agent:review CLI validates and inspects the same packet contract used by the skill', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-review-packet-'));
  const packetPath = path.join(directory, 'packet.json');
  const inputPath = path.join(directory, 'input.json');
  const handoffPath = path.join(directory, 'handoff.json');
  const command = path.join(root, 'scripts/agent-operations/review-packet.mjs');
  try {
    const input = reviewInput();
    writeFileSync(inputPath, JSON.stringify(input));
    writeFileSync(packetPath, JSON.stringify(packet({}, input)));
    writeFileSync(
      handoffPath,
      JSON.stringify({
        schemaVersion: 1,
        kind: 'proto-ui.skill-handoff',
        entrypoint: 'development',
        executionMode: 'human-assisted',
        executionModeSource: 'current-user',
        fromId: 'pui-validate',
        nextSkillId: 'pui-review',
        artifacts: [
          { type: 'authority-map', reference: 'review authority map' },
          { type: 'candidate-change', reference: 'bounded candidate change' },
          { type: 'evidence-report', reference: 'validation evidence' },
          { type: 'review-input', reference: inputPath },
        ],
        humanGates: [],
        notes: [],
      })
    );
    const validation = JSON.parse(
      execFileSync(
        process.execPath,
        [
          command,
          'validate',
          '--packet',
          packetPath,
          '--input',
          inputPath,
          '--handoff',
          handoffPath,
        ],
        {
          cwd: root,
          encoding: 'utf8',
        }
      )
    );
    assert.equal(validation.valid, true);
    const inspection = JSON.parse(
      execFileSync(
        process.execPath,
        [
          command,
          'inspect',
          '--packet',
          packetPath,
          '--input',
          inputPath,
          '--handoff',
          handoffPath,
          '--current-base',
          sha('a'),
          '--current-head',
          sha('b'),
          '--seen-keys',
          validation.key,
        ],
        { cwd: root, encoding: 'utf8' }
      )
    );
    assert.equal(inspection.run.duplicate, true);
    assert.equal(inspection.revision.stale, false);

    const eligibility = JSON.parse(
      execFileSync(
        process.execPath,
        [
          command,
          'eligibility',
          '--handoff',
          handoffPath,
          '--review-class',
          'review-cross-domain-semantics',
        ],
        { cwd: root, encoding: 'utf8' }
      )
    );
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.reviewDepth, 'partial');

    const inputDigest = JSON.parse(
      execFileSync(process.execPath, [command, 'input-digest', '--input', inputPath], {
        cwd: root,
        encoding: 'utf8',
      })
    );
    assert.equal(inputDigest.reviewInputDigest, computeReviewInputDigest(input));

    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            command,
            'eligibility',
            '--mode',
            'human-assisted',
            '--review-class',
            'review-cross-domain-semantics',
          ],
          { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        ),
      /Command failed/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
