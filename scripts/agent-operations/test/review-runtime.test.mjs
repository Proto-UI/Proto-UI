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
  computeReviewPacketDigest,
  decideReviewRun,
  evaluateReviewEligibility,
  inspectReviewRevision,
  reviewChangesSpecEntities,
  reviewPacketKey,
  renderReviewBody,
  validateReviewInputSnapshot,
  validateReviewPacket,
  validateReviewPacketEligibility,
  verifyLiveReviewInput,
  verifyReconciliation,
} from '../review-runtime.mjs';
import { agentEvidence } from './fixtures/agent-evidence.mjs';

const root = path.resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const policy = parseYaml(
  readFileSync(path.join(root, 'internal/agent-operations/capability-policy.yaml'), 'utf8')
);
const activePolicy = structuredClone(policy);
for (const authorization of [
  ...(activePolicy.collaborationMutationAuthorizations ?? []),
  ...(activePolicy.reviewSubmissionAuthorizations ?? []),
  ...(activePolicy.pullRequestMergeAuthorizations ?? []),
]) {
  authorization.status = 'active';
  delete authorization.blockedBy;
}
const sha = (letter) => letter.repeat(40);
const digest = (letter) => letter.repeat(64);

function reviewInput(overrides = {}) {
  const input = {
    schemaVersion: 5,
    kind: 'proto-ui.review-input',
    repositoryId: 'github.com:Proto-UI/Proto-UI',
    pullRequest: 487,
    pullRequestState: 'OPEN',
    pullRequestAuthor: 'contributor',
    isDraft: false,
    baseRefName: 'main',
    baseSha: sha('a'),
    headSha: sha('b'),
    pullRequestBody: 'Bounded review target',
    changedFiles: [
      {
        path: 'packages/core/src/index.ts',
        previousPath: null,
        status: 'modified',
      },
    ],
    commits: [
      {
        sha: sha('b'),
        message: 'Bounded change\n\nSigned-off-by: Contributor <contributor@example.com>',
        author: {
          login: 'contributor',
          name: 'Contributor',
          email: 'contributor@example.com',
          platform: null,
        },
        committer: {
          login: 'web-flow',
          name: 'GitHub',
          email: 'noreply@github.com',
          platform: null,
        },
      },
    ],
    reviews: [],
    comments: [],
    replies: [],
    threads: [],
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T00:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
        source: 'github-actions',
        providerId: 'APP_github_actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
    ],
    externalEvidence: [],
    ...overrides,
  };
  input.reviewerPermissions ??= [
    ...new Set(
      input.reviews
        .filter(
          (review) =>
            review.author !== null &&
            review.state === 'APPROVED' &&
            review.commitSha === input.headSha
        )
        .map((review) => review.author.toLowerCase())
    ),
  ].map((login) => ({
    login,
    permission: 'write',
    source: 'github-rest-collaborator-permission',
    endpoint: `repos/Proto-UI/Proto-UI/collaborators/${encodeURIComponent(login)}/permission`,
    repositoryId: input.repositoryId,
    headSha: input.headSha,
  }));
  return input;
}

function packet(overrides = {}, input = reviewInput()) {
  return {
    schemaVersion: 2,
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
    agentEvidence: agentEvidence(overrides.headSha ?? input.headSha),
    findings: [],
    validation: {
      commands: [
        { command: 'pnpm check:agent-operations', exitCode: 0, result: '26 tests passed' },
      ],
      checksNotRun: [],
    },
    reconciliation: {
      priorReviewedHeadSha: null,
      priorPacketDigest: null,
      resolvedFindingIds: [],
      openFindingIds: [],
      newFindingIds: [],
    },
    limitations: ['Review depth is limited without a fresh local assessment'],
    unknowns: [],
    humanGates: [],
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

function priorReviewFixture() {
  const priorInput = reviewInput({ headSha: sha('9') });
  const priorPacket = packet(
    {
      headSha: priorInput.headSha,
      recommendedAction: 'REQUEST_CHANGES',
      limitations: [],
      findings: [
        {
          id: 'F-PRIOR',
          severity: 'P1',
          confidence: 'high',
          file: 'scripts/example.mjs',
          line: 10,
          authority: 'internal/agent-operations/contributor-agents.md',
          observed: 'Prior findings can disappear from a new disposition',
          expected: 'Every prior finding is reconciled',
          impact: 'An approval can silently supersede an unresolved finding',
          fix: 'Bind reconciliation to the live prior review',
        },
      ],
      reconciliation: {
        priorReviewedHeadSha: null,
        priorPacketDigest: null,
        resolvedFindingIds: [],
        openFindingIds: [],
        newFindingIds: ['F-PRIOR'],
      },
    },
    priorInput
  );
  validateReviewPacket(priorPacket, priorInput);
  const review = {
    id: 'PRR_prior',
    author: 'agent',
    state: 'CHANGES_REQUESTED',
    commitSha: priorInput.headSha,
    submittedAt: '2026-08-22T00:00:00.000Z',
    body: renderReviewBody(priorPacket),
  };
  const boundary = (reviews = [review], overrides = {}) => {
    const input = reviewInput({ reviews });
    return {
      packet: packet({ limitations: [], recommendedAction: 'APPROVE' }, input),
      input,
      liveInput: structuredClone(input),
      executionMode: 'human-assisted',
      executionModeSource: 'current-user',
      authorizationId: 'explicit-current-user',
      policy,
      selfAssessment: null,
      credentialCanReview: true,
      reviewer: 'agent',
      ciConclusion: 'success',
      dcoConclusion: 'success',
      ...overrides,
    };
  };
  const reconciled = (base, prior = priorPacket) => ({
    ...base,
    priorPacket: prior,
    packet: {
      ...base.packet,
      reconciliation: {
        priorReviewedHeadSha: prior.headSha,
        priorPacketDigest: computeReviewPacketDigest(prior),
        resolvedFindingIds: prior.findings.map((finding) => finding.id),
        openFindingIds: [],
        newFindingIds: [],
      },
    },
  });
  return { priorPacket, review, boundary, reconciled };
}

test('review submission cannot null reconciliation to supersede its governed prior review', () => {
  const { boundary } = priorReviewFixture();
  const result = authorizeReviewSubmission(boundary());
  assert.equal(result.allowed, false, 'a live prior finding requires reconciliation');
  assert.match(result.reason, /prior review/);
});

test('governed prior reviews bind the artifact, live head and all prior findings', () => {
  const { priorPacket, review, boundary, reconciled } = priorReviewFixture();
  const valid = reconciled(boundary([{ ...review, author: 'AgEnT' }]));
  assert.equal(authorizeReviewSubmission(valid).allowed, true);
  for (const [label, candidate, reason] of [
    ['missing artifact', { ...valid, priorPacket: null }, /prior review artifact is required/],
    [
      'different artifact',
      { ...valid, priorPacket: { ...priorPacket, scope: ['unrelated scope'] } },
      /does not match the recorded priorPacketDigest/,
    ],
    [
      'unaccounted finding',
      {
        ...valid,
        packet: {
          ...valid.packet,
          reconciliation: { ...valid.packet.reconciliation, resolvedFindingIds: [] },
        },
      },
      /cover every prior finding/,
    ],
    [
      'wrong head',
      reconciled(boundary([{ ...review, commitSha: sha('8') }])),
      /latest governed prior review/,
    ],
    [
      'wrong live digest',
      reconciled(
        boundary([
          {
            ...review,
            body: review.body.replace(computeReviewPacketDigest(priorPacket), digest('0')),
          },
        ])
      ),
      /latest governed prior review/,
    ],
    [
      'missing head',
      reconciled(boundary([{ ...review, commitSha: null }])),
      /prior review head is unavailable/,
    ],
  ]) {
    const denied = authorizeReviewSubmission(candidate);
    assert.equal(denied.allowed, false, label);
    assert.match(denied.reason, reason, label);
  }

  const changes = reconciled(boundary());
  changes.packet.recommendedAction = 'REQUEST_CHANGES';
  changes.packet.findings = priorPacket.findings;
  changes.packet.reconciliation.resolvedFindingIds = [];
  changes.packet.reconciliation.openFindingIds = ['F-PRIOR'];
  assert.equal(authorizeReviewSubmission(changes).allowed, true);
  changes.packet.reconciliation.priorPacketDigest = null;
  changes.packet.reconciliation.priorReviewedHeadSha = null;
  assert.equal(authorizeReviewSubmission(changes).allowed, false);
});

test('a later COMMENT or forged receipt cannot erase a governed disposition', () => {
  const { priorPacket, review, boundary, reconciled } = priorReviewFixture();
  const laterPacket = packet({ limitations: [], recommendedAction: 'COMMENT' });
  const later = {
    ...review,
    id: 'PRR_later',
    commitSha: sha('b'),
    state: 'COMMENTED',
    submittedAt: '2026-08-23T01:00:00Z',
    body: renderReviewBody(laterPacket),
  };
  const token = `proto-ui:review-packet:sha256=${computeReviewPacketDigest(laterPacket)}`;
  const lookalikes = [
    token,
    `<!-- prefix-${token} -->`,
    `<!-- ${token}-suffix -->`,
    `<!-- ${token}f -->`,
    `<!-- ${token}`,
  ];
  for (const successor of [
    later,
    ...lookalikes.map((body) => ({ ...later, state: 'APPROVED', body })),
  ]) {
    const current = boundary([successor, review]);
    assert.equal(authorizeReviewSubmission(current).allowed, false);
    assert.equal(authorizeReviewSubmission(reconciled(current)).allowed, true);
    assert.equal(authorizeReviewSubmission(reconciled(current, laterPacket)).allowed, false);
  }
  // Marker text from another actor or an ordinary COMMENT establishes no
  // predecessor for the live reviewer. The real renderer is the positive control.
  for (const unrelated of [
    { ...review, author: 'someone-else' },
    { ...review, author: null },
    later,
  ]) {
    assert.equal(authorizeReviewSubmission(boundary([unrelated])).allowed, true);
  }
  for (const body of lookalikes) {
    assert.equal(authorizeReviewSubmission(boundary([{ ...review, body }])).allowed, true);
  }
  const foreign = { ...later, author: 'someone-else', state: 'APPROVED' };
  assert.equal(
    authorizeReviewSubmission(reconciled(boundary([review, foreign]), laterPacket)).allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission(reconciled(boundary([review, foreign]), priorPacket)).allowed,
    true
  );
});

test('prior review selection rejects older caller choices and ambiguous live order', () => {
  const { priorPacket, review, boundary, reconciled } = priorReviewFixture();
  const olderPacket = { ...priorPacket, scope: ['older reviewed scope'] };
  const older = {
    ...review,
    id: 'PRR_older',
    submittedAt: '2026-08-21T23:00:00Z',
    body: renderReviewBody(olderPacket),
  };
  assert.equal(
    authorizeReviewSubmission(reconciled(boundary([review, older]), olderPacket)).allowed,
    false
  );
  assert.equal(authorizeReviewSubmission(reconciled(boundary([review, older]))).allowed, true);
  for (const submittedAt of [null, review.submittedAt, '2026-08-22T02:00:00+02:00']) {
    const denied = authorizeReviewSubmission(
      reconciled(boundary([review, { ...older, submittedAt }]))
    );
    assert.equal(denied.allowed, false);
    assert.match(
      denied.reason,
      /prior review order is unavailable|prior review order is ambiguous/
    );
  }
  const multipleMarkers = {
    ...review,
    body: `${review.body}\n<!-- proto-ui:review-packet:sha256=${computeReviewPacketDigest(olderPacket)} -->`,
  };
  assert.match(
    authorizeReviewSubmission(reconciled(boundary([multipleMarkers]))).reason,
    /prior review packet marker is ambiguous/
  );
});

test('prior review binding preserves COMMENT disclosure, dismissal and duplicate no-op', () => {
  const { review, boundary } = priorReviewFixture();
  const disclosure = boundary();
  disclosure.packet.recommendedAction = 'COMMENT';
  disclosure.packet.limitations = ['Prior artifact is unavailable; findings remain unresolved'];
  assert.equal(authorizeReviewSubmission(disclosure).allowed, true);
  assert.equal(
    authorizeReviewSubmission(boundary([{ ...review, state: 'DISMISSED' }])).allowed,
    true
  );
  const dismissed = {
    ...review,
    id: 'PRR_dismissed',
    state: 'DISMISSED',
    submittedAt: '2026-08-23T01:00:00Z',
  };
  assert.equal(authorizeReviewSubmission(boundary([review, dismissed])).allowed, true);
  const published = {
    ...dismissed,
    id: 'PRR_published',
    state: 'APPROVED',
    commitSha: sha('b'),
    body: renderReviewBody(boundary().packet),
  };
  const duplicate = authorizeReviewSubmission(boundary([review, published]));
  assert.equal(duplicate.allowed, false);
  assert.equal(duplicate.duplicate, true);
});

test('submit-review CLI binds rendered live prior metadata before the mocked GitHub write', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-review-live-prior-'));
  const inputPath = path.join(directory, 'input.json');
  const packetPath = path.join(directory, 'packet.json');
  const priorPath = path.join(directory, 'prior.json');
  const handoffPath = path.join(directory, 'handoff.json');
  const fixturePath = path.join(directory, 'fixture.json');
  const callsPath = path.join(directory, 'calls.jsonl');
  const preloadPath = path.join(directory, 'mock-gh.mjs');
  try {
    const { priorPacket, boundary, reconciled } = priorReviewFixture();
    const base = boundary();
    base.input.checks = [
      ...policy.trustedCiEvidence.checkNames.map((name) => ({ ...base.input.checks[0], name })),
      {
        ...base.input.checks[0],
        name: 'DCO',
        source: policy.trustedDcoEvidence.source,
        providerId: policy.trustedDcoEvidence.providerId,
        detailsUrl: policy.trustedDcoEvidence.detailsUrl,
        workflowName: null,
        workflowPath: null,
      },
    ];
    base.packet = packet({ limitations: [], recommendedAction: 'APPROVE' }, base.input);
    const input = base.input;
    const connection = (nodes) => ({ nodes, pageInfo: { hasNextPage: false } });
    const actor = ({ login, name, email }) => ({ user: { login }, name, email });
    const contexts = connection(
      input.checks.map((check) => ({
        __typename: 'CheckRun',
        ...check,
        checkSuite: {
          app: { id: check.providerId, slug: check.source },
          repository: { nameWithOwner: check.repository },
          workflowRun: {
            file: { path: check.workflowPath },
            workflow: { name: check.workflowName },
          },
        },
      }))
    );
    writeFileSync(
      fixturePath,
      JSON.stringify({
        payload: {
          data: {
            viewer: { login: 'agent' },
            repository: {
              viewerPermission: 'WRITE',
              pullRequest: {
                state: input.pullRequestState,
                isDraft: input.isDraft,
                body: input.pullRequestBody,
                baseRefName: input.baseRefName,
                baseRefOid: input.baseSha,
                headRefOid: input.headSha,
                changedFiles: input.changedFiles.length,
                author: { login: input.pullRequestAuthor },
                commits: connection(
                  input.commits.map((commit) => ({
                    commit: {
                      oid: commit.sha,
                      message: commit.message,
                      author: actor(commit.author),
                      committer: actor(commit.committer),
                      statusCheckRollup: { contexts },
                    },
                  }))
                ),
                reviews: connection(
                  input.reviews.map((review) => ({
                    ...review,
                    author: { login: review.author },
                    commit: { oid: review.commitSha },
                  }))
                ),
                comments: connection([]),
                reviewThreads: connection([]),
              },
            },
          },
        },
        filePages: [
          input.changedFiles.map((file) => ({ filename: file.path, status: file.status })),
        ],
      })
    );
    writeFileSync(
      preloadPath,
      `
      import assert from 'node:assert/strict';
      import cp from 'node:child_process';
      import { appendFileSync, readFileSync } from 'node:fs';
      import { syncBuiltinESMExports } from 'node:module';
      const fixture = JSON.parse(readFileSync(process.env.PUI_REVIEW_TEST_FIXTURE, 'utf8'));
      cp.execFileSync = (command, args, options) => {
        assert.equal(command, 'gh');
        appendFileSync(process.env.PUI_REVIEW_TEST_CALLS, JSON.stringify(args) + '\\n');
        if (args[1] === 'graphql') return JSON.stringify(fixture.payload);
        if (args.includes('--paginate')) return JSON.stringify(fixture.filePages);
        if (args.includes('POST')) {
          const request = JSON.parse(options.input);
          return JSON.stringify({
            id: 999, state: 'APPROVED', commit_id: request.commit_id,
            body: request.body, user: { login: 'agent' },
          });
        }
        throw new Error('Unexpected mocked GitHub call: ' + args.join(' '));
      };
      syncBuiltinESMExports();
    `
    );
    writeFileSync(inputPath, JSON.stringify(input));
    writeFileSync(priorPath, JSON.stringify(priorPacket));
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
    const submit = (candidate, priorArgs = []) => {
      writeFileSync(packetPath, JSON.stringify(candidate));
      writeFileSync(callsPath, '');
      const result = JSON.parse(
        execFileSync(
          process.execPath,
          [
            '--import',
            preloadPath,
            path.join(root, 'scripts/agent-operations/review-packet.mjs'),
            'submit-review',
            '--input',
            inputPath,
            '--packet',
            packetPath,
            '--handoff',
            handoffPath,
            '--authorization',
            'explicit-current-user',
            ...priorArgs,
          ],
          {
            cwd: root,
            encoding: 'utf8',
            env: {
              ...process.env,
              PUI_REVIEW_TEST_FIXTURE: fixturePath,
              PUI_REVIEW_TEST_CALLS: callsPath,
            },
          }
        )
      );
      const calls = readFileSync(callsPath, 'utf8')
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));
      return { result, calls };
    };
    const blocked = submit(base.packet);
    assert.equal(blocked.result.allowed, false);
    assert.match(blocked.result.reason, /latest governed prior review/);
    assert.equal(
      blocked.calls.some((args) => args.includes('POST')),
      false
    );
    const allowed = submit(reconciled(base).packet, ['--prior-packet', priorPath]);
    assert.equal(allowed.result.allowed, true);
    assert.equal(allowed.result.submitted, true);
    assert.equal(allowed.calls.filter((args) => args.includes('POST')).length, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('review packets cannot silently omit public Agent evidence', () => {
  const legacy = packet();
  delete legacy.agentEvidence;
  assert.throws(() => validateReviewPacket(legacy, reviewInput()), /missing|agentEvidence/);
});

test('review rendering preserves evidence even when the finding list is empty', () => {
  const current = packet({ recommendedAction: 'COMMENT' });
  current.agentEvidence.visuals = [
    {
      url: 'https://example.com/observed.png',
      alt: 'Observed ownership transitions',
      caption: 'Synthetic transport test; no real observation claimed.',
    },
  ];
  current.agentEvidence.supportingUrls = ['https://example.com/reproduce.html'];
  const body = renderReviewBody(validateReviewPacket(current, reviewInput()));
  for (const value of [
    current.headSha,
    current.agentEvidence.requestParaphrase,
    current.agentEvidence.source,
    current.agentEvidence.scope,
    current.agentEvidence.baseline,
    current.agentEvidence.environment,
    current.agentEvidence.observedAt,
    ...current.agentEvidence.procedure,
    ...current.agentEvidence.observations,
    ...Object.values(current.agentEvidence.visuals[0]),
    ...current.agentEvidence.supportingUrls,
    ...Object.values(current.agentEvidence.debt[0]),
    ...current.limitations,
    current.validation.commands[0].result,
  ])
    assert.ok(body.includes(value), value);
  assert.ok(body.includes('**partial**'));
  assert.ok(body.includes('![Observed ownership transitions](<https://example.com/observed.png>)'));
  assert.ok(body.includes('No actionable findings within the stated review scope.'));
});

test('evidence validates head and debt without an image-presence submission gate', () => {
  for (const disposition of ['partial', 'blocked']) {
    const current = packet();
    current.agentEvidence.disposition = disposition;
    assert.equal(validateReviewPacket(current, reviewInput()), current);
    assert.ok(renderReviewBody(current).includes(`**${disposition}**`));
  }
  const wrongHead = packet();
  wrongHead.agentEvidence.headSha = sha('c');
  assert.throws(() => validateReviewPacket(wrongHead, reviewInput()), /bind the reviewed head/);
  const unexplained = packet();
  unexplained.agentEvidence.debt = [];
  assert.throws(() => validateReviewPacket(unexplained, reviewInput()), /agree with declared debt/);
  const concealed = packet();
  concealed.agentEvidence.disposition = 'complete';
  assert.throws(() => validateReviewPacket(concealed, reviewInput()), /agree with declared debt/);
  for (const url of [
    'D:/capture.png',
    'https://user:secret@example.com/image.png',
    'javascript:alert(1)',
  ]) {
    const invalid = packet();
    invalid.agentEvidence.visuals = [
      { url, alt: 'Invalid locator', caption: 'Not a public verified image' },
    ];
    assert.throws(() => validateReviewPacket(invalid, reviewInput()), /HTTPS URL|credentials/);
  }
});

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
      {
        sha: sha('c'),
        message: 'Second',
        author: {
          login: 'second-author',
          name: 'Second',
          email: 'second@example.com',
          platform: null,
        },
        committer: {
          login: 'web-flow',
          name: 'GitHub',
          email: 'noreply@github.com',
          platform: null,
        },
      },
      {
        sha: sha('b'),
        message: 'First',
        author: {
          login: 'first-author',
          name: 'First',
          email: 'first@example.com',
          platform: null,
        },
        committer: {
          login: 'web-flow',
          name: 'GitHub',
          email: 'noreply@github.com',
          platform: null,
        },
      },
    ],
  });
  const reversed = { ...reordered, commits: [...reordered.commits].reverse() };
  assert.equal(computeReviewInputDigest(reordered), computeReviewInputDigest(reversed));
  const reorderedKeys = Object.fromEntries(Object.entries(reordered).reverse());
  reorderedKeys.commits = reorderedKeys.commits.map((commit) => ({
    committer: commit.committer,
    author: commit.author,
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
        source: 'github-actions',
        providerId: 'APP_github_actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T00:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/1',
        source: 'github-actions',
        providerId: 'APP_github_actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
    ],
  });
  assert.equal(
    computeReviewInputDigest(tiedChecks),
    computeReviewInputDigest({ ...tiedChecks, checks: [...tiedChecks.checks].reverse() })
  );
  assert.notEqual(
    computeReviewInputDigest(tiedChecks),
    computeReviewInputDigest({
      ...tiedChecks,
      checks: tiedChecks.checks.map((check, index) =>
        index === 0
          ? {
              ...check,
              source: 'vercel',
              providerId: null,
              workflowName: null,
              workflowPath: null,
            }
          : check
      ),
    })
  );
  assert.notEqual(
    computeReviewInputDigest(reordered),
    computeReviewInputDigest({ ...reordered, pullRequestBody: 'Changed body' })
  );
});

test('canonical review input is insensitive to top-level comment connection order', () => {
  const first = reviewInput({
    comments: [
      {
        id: 'IC_2',
        author: 'maintainer',
        body: 'Second comment',
        updatedAt: '2026-08-23T02:00:00.000Z',
      },
      {
        id: 'IC_1',
        author: 'contributor',
        body: 'First comment',
        updatedAt: '2026-08-23T01:00:00.000Z',
      },
    ],
  });
  const reversed = reviewInput({ comments: [...first.comments].reverse() });

  assert.equal(computeReviewInputDigest(first), computeReviewInputDigest(reversed));
  assert.throws(
    () =>
      validateReviewInputSnapshot(
        reviewInput({ comments: [first.comments[0], first.comments[0]] })
      ),
    /duplicates comment id/
  );
});

test('review input v5 binds identities, changed files, and check provenance while classifying spec entities', () => {
  const ordinary = reviewInput();
  assert.equal(reviewChangesSpecEntities(ordinary), false);
  assert.equal(
    reviewChangesSpecEntities(
      reviewInput({
        changedFiles: [
          { path: 'spec/contracts/C-EXAMPLE-0001.yaml', previousPath: null, status: 'added' },
        ],
      })
    ),
    true
  );
  assert.equal(
    reviewChangesSpecEntities(
      reviewInput({
        changedFiles: [
          {
            path: 'internal/records/moved.md',
            previousPath: 'spec/decisions/D-EXAMPLE-0001.yaml',
            status: 'renamed',
          },
        ],
      })
    ),
    true
  );
  assert.equal(
    reviewChangesSpecEntities(
      reviewInput({
        changedFiles: [{ path: 'spec/README.md', previousPath: null, status: 'modified' }],
      })
    ),
    false
  );
  assert.notEqual(
    computeReviewInputDigest(ordinary),
    computeReviewInputDigest(
      reviewInput({
        changedFiles: [
          { path: 'packages/runtime/src/index.ts', previousPath: null, status: 'added' },
        ],
      })
    )
  );
  assert.throws(
    () => validateReviewInputSnapshot({ ...ordinary, schemaVersion: 1 }),
    /schemaVersion/
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
  const priorPacket = {
    ...packet({}, reviewInput()),
    headSha: sha('9'),
    findings: [{ ...finding, id: 'F-0' }],
  };
  const valid = packet(
    {
      findings: [finding],
      reconciliation: {
        priorReviewedHeadSha: sha('9'),
        priorPacketDigest: computeReviewPacketDigest(priorPacket),
        resolvedFindingIds: ['F-0'],
        openFindingIds: [],
        newFindingIds: ['F-1'],
      },
    },
    input
  );
  assert.equal(validateReviewPacket(valid, input), valid);
  assert.equal(verifyReconciliation(valid, priorPacket), true);
  assert.equal(validateReviewInputSnapshot(input), input);

  const boundTo = (prior) =>
    packet(
      {
        reconciliation: {
          ...valid.reconciliation,
          priorPacketDigest: computeReviewPacketDigest(prior),
        },
      },
      input
    );
  const digestMismatch = { ...priorPacket, recommendedAction: 'COMMENT' };
  assert.throws(
    () => verifyReconciliation(valid, digestMismatch),
    /does not match the recorded priorPacketDigest/
  );
  const differentRepository = {
    ...priorPacket,
    repositoryId: 'github.com:Proto-UI/Other',
  };
  assert.throws(
    () => verifyReconciliation(boundTo(differentRepository), differentRepository),
    /different repository/
  );
  const differentPullRequest = { ...priorPacket, pullRequest: 999 };
  assert.throws(
    () => verifyReconciliation(boundTo(differentPullRequest), differentPullRequest),
    /different pull request/
  );
  const differentHead = { ...priorPacket, headSha: sha('8') };
  assert.throws(
    () => verifyReconciliation(boundTo(differentHead), differentHead),
    /does not match priorReviewedHeadSha/
  );

  // Finding state transitions must be real against the prior packet's findings.
  const resolvedAbsentFromPrior = packet(
    {
      reconciliation: {
        ...valid.reconciliation,
        priorPacketDigest: computeReviewPacketDigest(priorPacket),
        resolvedFindingIds: ['F-9'],
      },
    },
    input
  );
  assert.throws(
    () => verifyReconciliation(resolvedAbsentFromPrior, priorPacket),
    /resolved reconciliation references a finding absent from the prior packet/
  );
  const openAbsentFromPrior = packet(
    {
      reconciliation: {
        ...valid.reconciliation,
        priorPacketDigest: computeReviewPacketDigest(priorPacket),
        newFindingIds: [],
        openFindingIds: ['F-1'],
      },
    },
    input
  );
  assert.throws(
    () => verifyReconciliation(openAbsentFromPrior, priorPacket),
    /open reconciliation references a finding absent from the prior packet/
  );
  const newAlreadyInPrior = packet(
    {
      findings: [{ ...finding, id: 'F-0' }],
      reconciliation: {
        ...valid.reconciliation,
        resolvedFindingIds: [],
        openFindingIds: [],
        newFindingIds: ['F-0'],
      },
    },
    input
  );
  assert.throws(
    () => verifyReconciliation(newAlreadyInPrior, priorPacket),
    /new reconciliation reuses a finding id/
  );
  const unboundIncremental = packet(
    {
      findings: [finding],
      reconciliation: {
        priorReviewedHeadSha: sha('9'),
        priorPacketDigest: null,
        resolvedFindingIds: ['F-0'],
        openFindingIds: [],
        newFindingIds: ['F-1'],
      },
    },
    input
  );
  assert.throws(
    () => validateReviewPacket(unboundIncremental, input),
    /must bind both the prior head and the prior packet digest/
  );
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

test('reconciliation must cover every prior finding exactly once', () => {
  // PR509-RECONCILIATION-COVERAGE-001: membership alone let a packet silently
  // omit a prior finding (prior F-OLD with empty resolved/open/new passed).
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
  const priorPacket = {
    ...packet({}, reviewInput()),
    headSha: sha('9'),
    findings: [
      { ...finding, id: 'F-0' },
      { ...finding, id: 'F-OLD' },
    ],
  };
  const reconcile = (states) =>
    packet(
      {
        findings: [finding],
        reconciliation: {
          priorReviewedHeadSha: sha('9'),
          priorPacketDigest: computeReviewPacketDigest(priorPacket),
          resolvedFindingIds: [],
          openFindingIds: [],
          newFindingIds: ['F-1'],
          ...states,
        },
      },
      input
    );
  const omitted = reconcile({ resolvedFindingIds: ['F-0'] });
  assert.throws(
    () => verifyReconciliation(omitted, priorPacket),
    /cover every prior finding exactly once/,
    'an omitted prior finding must fail closed'
  );
  const fullyDropped = reconcile({});
  assert.throws(
    () => verifyReconciliation(fullyDropped, priorPacket),
    /cover every prior finding exactly once/,
    'empty resolved/open sets must not reconcile a non-empty prior packet'
  );
  const overlapped = reconcile({ resolvedFindingIds: ['F-0'], openFindingIds: ['F-0', 'F-OLD'] });
  assert.throws(
    () => verifyReconciliation(overlapped, priorPacket),
    /overlap or repeat/,
    'a finding accounted twice must fail closed'
  );
  const unknownNew = reconcile({
    resolvedFindingIds: ['F-0'],
    openFindingIds: ['F-OLD'],
    newFindingIds: ['F-2'],
  });
  assert.throws(
    () => verifyReconciliation(unknownNew, priorPacket),
    /absent from the current packet/,
    'new reconciliation must reference a current finding'
  );
  const complete = reconcile({ resolvedFindingIds: ['F-0'], openFindingIds: ['F-OLD'] });
  assert.equal(verifyReconciliation(complete, priorPacket), true);
});

test('agent:review submit-review consumes the bound prior packet before any live call', () => {
  // PR509-RECONCILIATION-COVERAGE-001: submission must verify the packet
  // against the exact prior packet it reconciles whenever priorPacketDigest
  // is non-null, before any live collection or write.
  const directory = mkdtempSync(path.join(tmpdir(), 'pui-review-submit-prior-'));
  const packetPath = path.join(directory, 'packet.json');
  const priorPath = path.join(directory, 'prior-packet.json');
  const inputPath = path.join(directory, 'input.json');
  const handoffPath = path.join(directory, 'handoff.json');
  const command = path.join(root, 'scripts/agent-operations/review-packet.mjs');
  try {
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
    const priorPacket = {
      ...packet({}, reviewInput()),
      headSha: sha('9'),
      findings: [{ ...finding, id: 'F-0' }],
    };
    const boundPacket = packet(
      {
        findings: [finding],
        reconciliation: {
          priorReviewedHeadSha: sha('9'),
          priorPacketDigest: computeReviewPacketDigest(priorPacket),
          resolvedFindingIds: ['F-0'],
          openFindingIds: [],
          newFindingIds: ['F-1'],
        },
      },
      input
    );
    writeFileSync(inputPath, JSON.stringify(input));
    writeFileSync(packetPath, JSON.stringify(boundPacket));
    writeFileSync(priorPath, JSON.stringify(priorPacket));
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
    const submitArgs = [
      command,
      'submit-review',
      '--packet',
      packetPath,
      '--input',
      inputPath,
      '--handoff',
      handoffPath,
    ];
    assert.throws(
      () => execFileSync(process.execPath, submitArgs, { cwd: root, encoding: 'utf8' }),
      (error) => /--prior-packet is required/.test(error.stderr ?? ''),
      'submission without the bound prior packet must fail before live collection'
    );
    const tamperedPrior = { ...priorPacket, recommendedAction: 'COMMENT' };
    writeFileSync(priorPath, JSON.stringify(tamperedPrior));
    assert.throws(
      () =>
        execFileSync(process.execPath, [...submitArgs, '--prior-packet', priorPath], {
          cwd: root,
          encoding: 'utf8',
        }),
      (error) => /does not match the recorded priorPacketDigest/.test(error.stderr ?? ''),
      'submission must verify the exact bound prior packet before live collection'
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('human-assisted review is dispositive without assessment while autonomous review obeys the exact class ceiling', () => {
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
      reviewDepth: 'full',
      maximumRecommendation: 'APPROVE',
      limitationRequired: false,
      approvalDecisionRequired: false,
    }
  );
  assert.deepEqual(
    evaluateReviewEligibility({
      executionMode: 'human-assisted',
      selfAssessment: null,
      reviewClass: 'review-governed-implementation-slice',
      policy,
    }),
    {
      eligible: true,
      reviewDepth: 'full',
      maximumRecommendation: 'APPROVE',
      limitationRequired: false,
      approvalDecisionRequired: false,
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
  assert.equal(bounded.maximumRecommendation, 'APPROVE');
  assert.equal(bounded.approvalDecisionRequired, 'when-unresolved-product-direction');
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
  assert.doesNotThrow(() =>
    validateReviewPacketEligibility(
      packet({ recommendedAction: 'REQUEST_CHANGES', limitations: [] }),
      evaluateReviewEligibility({
        executionMode: 'human-assisted',
        selfAssessment: null,
        reviewClass: 'review-governed-implementation-slice',
        policy,
      }),
      'human-assisted'
    )
  );
});

test('approval discloses a Vercel authorization failure as publication debt', () => {
  const input = reviewInput({
    checks: [
      ...reviewInput().checks,
      {
        name: 'Vercel',
        status: 'COMPLETED',
        conclusion: 'FAILURE',
        completedAt: '2026-09-23T03:00:00Z',
        detailsUrl: 'https://vercel.com/git/authorize?team=external',
        source: 'vercel',
        providerId: null,
        repository: null,
        workflowName: null,
        workflowPath: null,
      },
    ],
  });
  const review = packet({ limitations: [], humanGates: [], recommendedAction: 'APPROVE' }, input);
  const submission = {
    packet: review,
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy,
    credentialCanReview: true,
    reviewer: 'agent',
    pullRequestAuthor: 'contributor',
    ciConclusion: 'success',
    dcoConclusion: 'success',
  };

  assert.equal(authorizeReviewSubmission(submission).allowed, false);
  review.agentEvidence.debt.push({
    kind: 'publication',
    missing: 'Vercel preview deployment',
    reason: 'The external team has not authorized the contributor; repository CI passed.',
    nextAction: 'Authorize deployment and verify the preview independently.',
    previewAuthorization: {
      provider: 'vercel',
      checkName: 'Vercel',
      authorizationUrl: input.checks.at(-1).detailsUrl,
    },
  });
  assert.equal(authorizeReviewSubmission(submission).allowed, true);
  assert.match(renderReviewBody(review), /Vercel preview deployment/);
  assert.match(renderReviewBody(review), /Preview authorization: vercel\/Vercel/);
  assert.match(renderReviewBody(review), /https:\/\/vercel.com\/git\/authorize\?team=external/);

  const previewDebt = review.agentEvidence.debt.at(-1);
  for (const malformed of [
    null,
    { provider: 'vercel', checkName: 'Vercel' },
    { ...previewDebt.previewAuthorization, provider: 'status-context' },
    { ...previewDebt.previewAuthorization, checkName: 'Other preview' },
    {
      ...previewDebt.previewAuthorization,
      authorizationUrl: 'https://vercel.example/git/authorize',
    },
    {
      ...previewDebt.previewAuthorization,
      authorizationUrl: 'https://vercel.com/deployments/failed',
    },
    { ...previewDebt.previewAuthorization, extra: true },
  ]) {
    const invalid = structuredClone(review);
    invalid.agentEvidence.debt.at(-1).previewAuthorization = malformed;
    assert.throws(() => validateReviewPacket(invalid, input), /previewAuthorization/);
  }
  previewDebt.previewAuthorization.authorizationUrl =
    'https://vercel.com/git/authorize?team=another';
  assert.equal(authorizeReviewSubmission(submission).allowed, false);
});

test('review submission preserves explicit authorization and activates the bounded scheduled scope', () => {
  const input = reviewInput();
  const base = {
    packet: packet(
      {
        limitations: [],
        humanGates: [],
        recommendedAction: 'APPROVE',
      },
      input
    ),
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy,
    credentialCanReview: true,
    reviewer: 'agent',
    ciConclusion: 'success',
    dcoConclusion: 'success',
  };
  assert.equal(authorizeReviewSubmission({ ...base, authorizationId: 'wrong' }).allowed, false);
  assert.equal(authorizeReviewSubmission({ ...base, credentialCanReview: false }).allowed, false);
  assert.equal(authorizeReviewSubmission(base).allowed, true);
  assert.equal(
    authorizeReviewSubmission({ ...base, executionModeSource: 'active-human-loop' }).allowed,
    true
  );
  assert.equal(
    authorizeReviewSubmission({
      ...base,
      reviewer: 'contributor',
      packet: packet(
        {
          findings: [
            {
              id: 'F-1',
              severity: 'P1',
              confidence: 'high',
              file: 'src/a.ts',
              line: 1,
              authority: 'governed rule',
              observed: 'broken',
              expected: 'working',
              impact: 'regression',
              fix: 'repair',
            },
          ],
          limitations: [],
          unknowns: [],
          humanGates: [],
          recommendedAction: 'REQUEST_CHANGES',
          reconciliation: {
            priorReviewedHeadSha: null,
            priorPacketDigest: null,
            resolvedFindingIds: [],
            openFindingIds: [],
            newFindingIds: ['F-1'],
          },
        },
        input
      ),
    }).allowed,
    false
  );
  const contributorInput = reviewInput({ pullRequestAuthor: 'different-pr-author' });
  assert.match(
    authorizeReviewSubmission({
      ...base,
      input: contributorInput,
      liveInput: structuredClone(contributorInput),
      reviewer: 'CONTRIBUTOR',
      packet: packet(
        { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
        contributorInput
      ),
    }).reason,
    /commit contributor/
  );
  assert.match(
    authorizeReviewSubmission({
      ...base,
      input: contributorInput,
      liveInput: structuredClone(contributorInput),
      reviewer: 'web-flow',
      packet: packet(
        {
          findings: [
            {
              id: 'F-COMMITTER',
              severity: 'P1',
              confidence: 'high',
              file: 'src/a.ts',
              line: 1,
              authority: 'governed rule',
              observed: 'broken',
              expected: 'working',
              impact: 'regression',
              fix: 'repair',
            },
          ],
          limitations: [],
          unknowns: [],
          humanGates: [],
          recommendedAction: 'REQUEST_CHANGES',
          reconciliation: {
            priorReviewedHeadSha: null,
            priorPacketDigest: null,
            resolvedFindingIds: [],
            openFindingIds: [],
            newFindingIds: ['F-COMMITTER'],
          },
        },
        contributorInput
      ),
    }).reason,
    /commit contributor/
  );
  const unlinkedContributorInput = structuredClone(contributorInput);
  unlinkedContributorInput.commits[0].author.login = null;
  assert.match(
    authorizeReviewSubmission({
      ...base,
      input: unlinkedContributorInput,
      liveInput: structuredClone(unlinkedContributorInput),
      packet: packet(
        { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
        unlinkedContributorInput
      ),
    }).reason,
    /verifiable platform identity/
  );
  // PR509-CONTRIBUTOR-IDENTITY-001: a GitHub platform committer verified
  // through GitHub's own signature attestation is an explicit trusted system
  // identity, not an unresolved null; the fail-closed rule is not weakened
  // for human commits without a linked account (the case above).
  const platformCommitterInput = structuredClone(contributorInput);
  platformCommitterInput.commits[0].committer = {
    login: null,
    name: 'GitHub',
    email: 'noreply@github.com',
    platform: { kind: 'github-web-flow', attestation: 'valid-github-signature' },
  };
  assert.equal(
    authorizeReviewSubmission({
      ...base,
      input: platformCommitterInput,
      liveInput: structuredClone(platformCommitterInput),
      packet: packet(
        { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
        platformCommitterInput
      ),
    }).allowed,
    true
  );
  const forgedPlatformInput = structuredClone(platformCommitterInput);
  forgedPlatformInput.commits[0].committer.platform = {
    kind: 'github-web-flow',
    attestation: 'self-declared',
  };
  assert.throws(
    () => validateReviewInputSnapshot(forgedPlatformInput),
    /platform identity is invalid/
  );
  assert.equal(authorizeReviewSubmission({ ...base, ciConclusion: 'failure' }).allowed, false);
  assert.match(
    authorizeReviewSubmission({ ...base, dcoConclusion: 'unknown' }).reason,
    /DCO status/
  );

  const requestChangesPacket = packet(
    {
      findings: [
        {
          id: 'F-2',
          severity: 'P1',
          confidence: 'high',
          file: 'src/b.ts',
          line: 2,
          authority: 'governed rule',
          observed: 'broken',
          expected: 'working',
          impact: 'regression',
          fix: 'repair',
        },
      ],
      limitations: [],
      unknowns: [],
      humanGates: [],
      recommendedAction: 'REQUEST_CHANGES',
      reconciliation: {
        priorReviewedHeadSha: null,
        priorPacketDigest: null,
        resolvedFindingIds: [],
        openFindingIds: [],
        newFindingIds: ['F-2'],
      },
    },
    input
  );
  const humanRequestChanges = authorizeReviewSubmission({
    ...base,
    packet: requestChangesPacket,
  });
  assert.equal(humanRequestChanges.allowed, true);
  assert.equal(humanRequestChanges.recommendedAction, 'REQUEST_CHANGES');
  const scheduledBase = {
    ...base,
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    authorizationId: 'proto-ui-scheduled-review-v1',
    policy: activePolicy,
    selfAssessment: assessment('C4', Object.keys(activePolicy.reviewClasses)),
  };
  const requestChanges = authorizeReviewSubmission({
    ...scheduledBase,
    packet: requestChangesPacket,
  });
  assert.equal(requestChanges.allowed, true);
  assert.equal(requestChanges.recommendedAction, 'REQUEST_CHANGES');
  const scheduledApproval = authorizeReviewSubmission(scheduledBase);
  assert.equal(scheduledApproval.allowed, true);
  assert.equal(scheduledApproval.recommendedAction, 'APPROVE');
  for (const boundary of [base, scheduledBase]) {
    for (const reviewed of [base.packet, requestChangesPacket]) {
      const unverified = structuredClone(reviewed);
      unverified.agentEvidence.debt = [
        {
          kind: 'verification',
          missing: 'Declared behavior not reproduced',
          reason: 'Host unavailable',
          nextAction: 'Run the required target before disposition',
        },
      ];
      const denied = authorizeReviewSubmission({ ...boundary, packet: unverified });
      assert.equal(denied.allowed, false);
      assert.match(denied.reason, /verification debt/);
    }
  }
  const honestComment = structuredClone(base.packet);
  honestComment.recommendedAction = 'COMMENT';
  honestComment.agentEvidence.debt[0].kind = 'verification';
  assert.equal(authorizeReviewSubmission({ ...base, packet: honestComment }).allowed, true);
  const reviewEligibleC3 = assessment('C3', [
    'review-facts-and-ci',
    'review-docs-and-links',
    'review-tests',
    'review-bounded-regression',
    'review-governed-implementation-slice',
  ]);
  assert.equal(
    evaluateReviewEligibility({
      executionMode: 'autonomous',
      selfAssessment: reviewEligibleC3,
      reviewClass: scheduledBase.packet.reviewClass,
      policy: activePolicy,
    }).eligible,
    true
  );
  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      selfAssessment: reviewEligibleC3,
    }).allowed,
    true
  );
  assert.equal(
    authorizeReviewSubmission({ ...scheduledBase, selfAssessment: null }).allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      selfAssessment: { ...scheduledBase.selfAssessment, fresh: false },
    }).allowed,
    false
  );
  assert.equal(
    authorizeReviewSubmission({ ...scheduledBase, executionModeSource: 'governed-queue' }).allowed,
    false
  );

  // A legacy same-head approval without this packet's rendered body must not
  // block a changed evidence packet; only an exact rendered-body match is an
  // idempotent duplicate.
  const legacyDuplicateInput = reviewInput({
    reviews: [
      {
        id: 'PRR_existing',
        author: 'agent',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-23T03:00:00.000Z',
        body: 'Reviewed exact head `bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`.',
      },
    ],
  });
  const legacyDuplicate = authorizeReviewSubmission({
    ...scheduledBase,
    input: legacyDuplicateInput,
    liveInput: structuredClone(legacyDuplicateInput),
    packet: packet(
      { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
      legacyDuplicateInput
    ),
  });
  assert.equal(legacyDuplicate.allowed, true);
  assert.equal(legacyDuplicate.duplicate, undefined);

  const publishedPacket = packet(
    { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
    reviewInput()
  );
  const publishedBody = renderReviewBody(publishedPacket);
  assert.ok(publishedBody.includes('proto-ui:review-packet:sha256='));
  assert.ok(publishedBody.includes('proto-ui:agent-evidence:sha256='));
  const exactDuplicateInput = reviewInput({
    reviews: [
      {
        id: 'PRR_exact',
        author: 'agent',
        state: 'APPROVED',
        commitSha: sha('b'),
        submittedAt: '2026-08-23T03:00:00.000Z',
        body: publishedBody,
      },
    ],
  });
  const exactDuplicateApproval = authorizeReviewSubmission({
    ...scheduledBase,
    input: exactDuplicateInput,
    liveInput: structuredClone(exactDuplicateInput),
    packet: packet(
      { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
      exactDuplicateInput
    ),
  });
  assert.equal(exactDuplicateApproval.allowed, false);
  assert.equal(exactDuplicateApproval.duplicate, true);

  const specInput = reviewInput({
    changedFiles: [
      { path: 'spec/contracts/C-EXAMPLE-0001.yaml', previousPath: null, status: 'modified' },
    ],
  });
  const specApproval = authorizeReviewSubmission({
    ...scheduledBase,
    input: specInput,
    liveInput: structuredClone(specInput),
    packet: packet(
      {
        limitations: [],
        humanGates: [],
        recommendedAction: 'APPROVE',
      },
      specInput
    ),
  });
  assert.equal(specApproval.allowed, true);
  assert.equal(
    authorizeReviewSubmission({
      ...base,
      input: specInput,
      liveInput: structuredClone(specInput),
      packet: packet(
        {
          limitations: [],
          humanGates: [],
          recommendedAction: 'APPROVE',
        },
        specInput
      ),
    }).allowed,
    true
  );
  const unresolvedProductDirection = authorizeReviewSubmission({
    ...scheduledBase,
    input: specInput,
    liveInput: structuredClone(specInput),
    packet: packet(
      {
        limitations: [],
        humanGates: ['unresolved-product-direction'],
        recommendedAction: 'APPROVE',
      },
      specInput
    ),
  });
  assert.equal(unresolvedProductDirection.allowed, false);
  assert.match(unresolvedProductDirection.reason, /clean review packet/);

  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      packet: packet({ limitations: [], humanGates: [], recommendedAction: 'COMMENT' }, input),
    }).allowed,
    true
  );
  assert.equal(
    authorizeReviewSubmission({
      ...scheduledBase,
      input: reviewInput({ isDraft: true }),
      liveInput: reviewInput({ isDraft: true }),
      packet: packet(
        { limitations: [], humanGates: [], recommendedAction: 'APPROVE' },
        reviewInput({ isDraft: true })
      ),
    }).allowed,
    true
  );
});

test('review packets accept only the two attended decision classes', () => {
  const input = reviewInput();
  assert.doesNotThrow(() =>
    validateReviewPacket(packet({ humanGates: ['unresolved-product-direction'] }, input), input)
  );
  assert.doesNotThrow(() =>
    validateReviewPacket(
      packet({ humanGates: ['privileged-or-irreversible-operation'] }, input),
      input
    )
  );
  assert.throws(
    () => validateReviewPacket(packet({ humanGates: ['pull-request-approval'] }, input), input),
    /unknown attended decision class/
  );
});

test('an active scheduled standing authorization can submit an exact-head review disposition', () => {
  const input = reviewInput();
  const activePolicy = structuredClone(policy);
  const authorization = activePolicy.reviewSubmissionAuthorizations.find(
    (candidate) => candidate.id === 'proto-ui-scheduled-review-v1'
  );
  authorization.status = 'active';
  delete authorization.blockedBy;
  const approval = authorizeReviewSubmission({
    packet: packet({ limitations: [], humanGates: [], recommendedAction: 'APPROVE' }, input),
    input,
    liveInput: structuredClone(input),
    executionMode: 'autonomous',
    executionModeSource: 'schedule',
    authorizationId: 'proto-ui-scheduled-review-v1',
    policy: activePolicy,
    selfAssessment: assessment('C4', Object.keys(activePolicy.reviewClasses)),
    credentialCanReview: true,
    reviewer: 'agent',
    ciConclusion: 'success',
    dcoConclusion: 'success',
  });
  assert.equal(approval.allowed, true);
  assert.equal(approval.recommendedAction, 'APPROVE');
});

test('submission preflight re-collects live canonical input and rejects drift and forged identities', () => {
  const input = reviewInput();
  const base = {
    packet: packet({ recommendedAction: 'COMMENT', limitations: [] }, input),
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy,
    credentialCanReview: true,
    reviewer: 'agent',
    ciConclusion: 'success',
    dcoConclusion: 'success',
  };

  // A new reply on the same head changes the canonical input digest: submission must reject.
  const driftedLiveInput = reviewInput({
    replies: [
      {
        id: 'r1',
        threadId: 't1',
        updatedAt: '2026-08-23T01:00:00.000Z',
        author: 'maintainer',
        body: 'New question on the same head',
      },
    ],
  });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: driftedLiveInput }),
    /live canonical review input does not match/
  );

  const retargetedLiveInput = reviewInput({ baseRefName: 'release' });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: retargetedLiveInput }),
    /live canonical review input does not match/
  );

  const topLevelCommentDrift = reviewInput({
    comments: [
      {
        id: '2001',
        updatedAt: '2026-08-23T01:30:00.000Z',
        author: 'maintainer',
        body: 'New top-level question on the same head',
      },
    ],
  });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: topLevelCommentDrift }),
    /live canonical review input does not match/
  );
  assert.equal(verifyLiveReviewInput(base.packet, base.liveInput), true);
  assert.throws(
    () => verifyLiveReviewInput(base.packet, driftedLiveInput),
    /live canonical review input does not match/
  );

  // A CI rerun with a new check run also changes the digest.
  const rerunChecks = reviewInput({
    checks: [
      {
        name: 'test',
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        completedAt: '2026-08-23T02:00:00.000Z',
        detailsUrl: 'https://github.com/Proto-UI/Proto-UI/actions/runs/2',
        source: 'github-actions',
        providerId: 'APP_github_actions',
        repository: 'Proto-UI/Proto-UI',
        workflowName: 'CI',
        workflowPath: '.github/workflows/ci.yml',
      },
    ],
  });
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: rerunChecks }),
    /live canonical review input does not match/
  );

  // Live input must bind to the same repository and pull request.
  const differentPullRequest = reviewInput({ pullRequest: 999 });
  assert.throws(
    () => verifyLiveReviewInput(base.packet, differentPullRequest),
    /different repository or pull request/
  );

  // Reviewer identity must come from the trusted live context. PR and commit
  // contributor identities are canonical live-input fields, not caller claims.
  assert.throws(() => authorizeReviewSubmission({ ...base, reviewer: '' }), /viewer identity/);

  // Staleness is derived from the live revision, never from caller-supplied SHAs.
  const pushedLiveInput = { ...structuredClone(input), headSha: sha('d') };
  assert.throws(
    () => authorizeReviewSubmission({ ...base, liveInput: pushedLiveInput }),
    /live canonical review input does not match/
  );
});

test('runtime validation matches the review-packet JSON Schema for types and timestamps', () => {
  const input = reviewInput();
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
  for (const [field, value] of [
    ['file', 123],
    ['authority', { source: 'AGENTS.md' }],
    ['observed', ['drift']],
    ['expected', false],
    ['impact', 0],
    ['fix', null],
    ['id', ''],
  ]) {
    const invalidFinding = packet({ findings: [{ ...finding, [field]: value }] }, input);
    assert.throws(
      () => validateReviewPacket(invalidFinding, input),
      new RegExp(`finding\\.${field}`),
      `expected finding.${field} to be rejected`
    );
  }

  for (const observedAt of [0, 'August 23, 2026', '2026/08/23', '2026-08-23']) {
    assert.throws(
      () => validateReviewPacket(packet({ observedAt }, input), input),
      /observedAt/,
      `expected observedAt ${String(observedAt)} to be rejected`
    );
  }
  assert.doesNotThrow(() =>
    validateReviewPacket(packet({ observedAt: '2026-08-23T00:00:00+08:00' }, input), input)
  );
  assert.doesNotThrow(() =>
    validateReviewPacket(packet({ observedAt: '2026-08-23T00:00:00.123456Z' }, input), input)
  );

  const looseReplyTimestamp = reviewInput({
    replies: [
      {
        id: 'r1',
        threadId: 't1',
        updatedAt: '2026-08-23 00:00 UTC',
        author: 'maintainer',
        body: 'Loose timestamp',
      },
    ],
  });
  assert.throws(() => validateReviewInputSnapshot(looseReplyTimestamp), /reply updatedAt/);
  const epochThreadUpdate = reviewInput({
    threads: [{ id: 't1', isResolved: true, updatedAt: 1755907200000 }],
  });
  assert.throws(() => validateReviewInputSnapshot(epochThreadUpdate), /thread updatedAt/);
  assert.throws(() => validateReviewPacket(packet({ observedAt: 0 }, input), input), /observedAt/);
});

test('review input validation accepts nullable check details links but rejects empty ones', () => {
  const withCheck = (detailsUrl) =>
    reviewInput({
      checks: [
        {
          name: 'test',
          status: 'COMPLETED',
          conclusion: 'SUCCESS',
          completedAt: '2026-08-23T00:00:00.000Z',
          detailsUrl,
          source: 'github-actions',
          providerId: 'APP_github_actions',
          repository: 'Proto-UI/Proto-UI',
          workflowName: 'CI',
          workflowPath: '.github/workflows/ci.yml',
        },
      ],
    });

  assert.doesNotThrow(() => validateReviewInputSnapshot(withCheck(null)));
  assert.throws(() => validateReviewInputSnapshot(withCheck('')), /check detailsUrl/);
  assert.throws(() => validateReviewInputSnapshot(withCheck(undefined)), /check detailsUrl/);
});

test('review input validation rejects malformed changed-file and review identity state', () => {
  assert.throws(
    () => validateReviewInputSnapshot(reviewInput({ changedFiles: [] })),
    /changedFiles/
  );
  assert.throws(
    () =>
      validateReviewInputSnapshot(
        reviewInput({
          changedFiles: [
            { path: '../spec/contracts/C-X.yaml', previousPath: null, status: 'added' },
          ],
        })
      ),
    /changed file path/
  );
  assert.throws(
    () =>
      validateReviewInputSnapshot(
        reviewInput({
          reviews: [
            {
              id: 'r1',
              author: 'reviewer',
              state: 'APPROVED',
              commitSha: 'short',
              submittedAt: '2026-08-23T00:00:00Z',
              body: '',
            },
          ],
        })
      ),
    /commitSha/
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
    writeFileSync(
      packetPath,
      JSON.stringify(packet({ limitations: [], recommendedAction: 'APPROVE' }, input))
    );
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
    assert.equal(inspection.reconciliationBound, null);

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
    assert.equal(eligibility.reviewDepth, 'full');
    assert.equal(eligibility.maximumRecommendation, 'APPROVE');
    assert.equal(eligibility.limitationRequired, false);
    assert.equal(eligibility.approvalDecisionRequired, false);

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
    assert.throws(
      () =>
        execFileSync(
          process.execPath,
          [
            command,
            'submit-review',
            '--packet',
            packetPath,
            '--input',
            inputPath,
            '--reviewer',
            'forged-login',
            '--pr-author',
            'forged-author',
            '--credential',
            'can-review',
            '--ci-conclusion',
            'success',
          ],
          { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
        ),
      /unexpected option/
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('legacy schema v1 packets ingest without evidence but cannot carry dispositions', () => {
  const input = reviewInput();
  const legacy = packet({ recommendedAction: 'COMMENT' }, input);
  delete legacy.agentEvidence;
  legacy.schemaVersion = 1;
  assert.equal(validateReviewPacket(legacy, input), legacy);

  const legacyBody = renderReviewBody(legacy);
  assert.ok(legacyBody.includes('legacy schema v1'));
  assert.ok(legacyBody.includes('proto-ui:review-packet:sha256='));
  assert.ok(!legacyBody.includes('proto-ui:agent-evidence:sha256='));

  const smuggled = packet({ recommendedAction: 'COMMENT' }, input);
  smuggled.schemaVersion = 1;
  assert.throws(() => validateReviewPacket(smuggled, input), /unexpected|agentEvidence/);

  const base = {
    input,
    liveInput: structuredClone(input),
    executionMode: 'human-assisted',
    executionModeSource: 'current-user',
    authorizationId: 'explicit-current-user',
    policy,
    credentialCanReview: true,
    reviewer: 'agent',
    pullRequestAuthor: 'contributor',
    ciConclusion: 'success',
  };
  const comment = authorizeReviewSubmission({ ...base, packet: legacy });
  assert.equal(comment.allowed, true);

  for (const recommendedAction of ['APPROVE', 'REQUEST_CHANGES']) {
    const disposition = packet({ recommendedAction }, input);
    delete disposition.agentEvidence;
    disposition.schemaVersion = 1;
    const result = authorizeReviewSubmission({ ...base, packet: disposition });
    assert.equal(result.allowed, false);
    assert.match(result.reason, /schema v2/);
  }

  const invalidVersion = packet({ recommendedAction: 'COMMENT' }, input);
  invalidVersion.schemaVersion = 3;
  assert.throws(() => validateReviewPacket(invalidVersion, input), /schemaVersion/);
});
