import { LEDGER_REPOSITORY } from '../../cloud-review-ledger.mjs';
import { computeReviewInputDigest } from '../../review-runtime.mjs';
import { agentEvidence } from './agent-evidence.mjs';
const sha = (value) => value.repeat(40);
export function analysis(overrides = {}) {
  const input = {
    schemaVersion: 5,
    kind: 'proto-ui.review-input',
    repositoryId: LEDGER_REPOSITORY,
    pullRequest: 487,
    pullRequestState: 'OPEN',
    pullRequestAuthor: 'contributor',
    reviewerPermissions: [],
    isDraft: false,
    baseRefName: 'main',
    baseSha: sha('a'),
    headSha: sha('b'),
    pullRequestBody: 'fixture',
    changedFiles: [{ path: 'packages/core/src/index.ts', previousPath: null, status: 'modified' }],
    commits: [
      {
        sha: sha('b'),
        message: 'fixture',
        author: { login: 'contributor', name: '', email: '', platform: null },
        committer: { login: 'contributor', name: '', email: '', platform: null },
      },
    ],
    reviews: [],
    comments: [],
    replies: [],
    threads: [],
    checks: [],
    externalEvidence: [],
    ...overrides,
  };
  const packet = {
    schemaVersion: 2,
    kind: 'proto-ui.review-packet',
    repositoryId: input.repositoryId,
    pullRequest: input.pullRequest,
    baseSha: input.baseSha,
    headSha: input.headSha,
    reviewInputDigest: computeReviewInputDigest(input),
    observedAt: '2026-10-02T00:00:00Z',
    reviewClass: 'review-governed-implementation-slice',
    scope: ['fixture'],
    affectedEntities: [],
    affectedSurfaces: ['scripts'],
    agentEvidence: agentEvidence(input.headSha),
    findings: [],
    validation: {
      commands: [{ command: 'fixture', exitCode: 0, result: 'synthetic' }],
      checksNotRun: [],
    },
    reconciliation: {
      priorReviewedHeadSha: null,
      priorPacketDigest: null,
      resolvedFindingIds: [],
      openFindingIds: [],
      newFindingIds: [],
    },
    limitations: [],
    unknowns: [],
    humanGates: [],
    recommendedAction: 'APPROVE',
  };
  return {
    input,
    packet,
    liveInput: structuredClone(input),
    observation: {
      executionMode: 'autonomous',
      executionModeSource: 'delegated-owner-event',
      reviewerId: '52768321',
      reviewerLogin: 'guangliang2019',
      authorId: '19223209',
      authorLogin: 'contributor',
      policyDigest: 'f'.repeat(64),
    },
  };
}
