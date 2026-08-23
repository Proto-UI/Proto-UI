import { execFileSync } from 'node:child_process';
import { validateReviewInputSnapshot } from './review-runtime.mjs';

const TERMINAL_CHECK_STATES = new Set(['SUCCESS', 'FAILURE', 'ERROR']);
const FAILED_CONCLUSIONS = new Set([
  'FAILURE',
  'ERROR',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'CANCELLED',
  'STARTUP_FAILURE',
]);

// GitHub GraphQL schema facts (verified against the live schema):
// - PullRequestReviewThread has no updatedAt; the latest comment updatedAt is authoritative.
// - Commit.statusCheckRollup takes no `first`; contexts are read through statusCheckRollup.contexts(first:).
export const QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $name) {
    viewerPermission
    pullRequest(number: $number) {
      body
      baseRefOid
      headRefOid
      author { login }
      commits(first: 100) {
        nodes { commit { oid messageHeadline } }
        pageInfo { hasNextPage }
      }
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          comments(first: 100) {
            nodes { databaseId author { login } body updatedAt }
            pageInfo { hasNextPage }
          }
        }
        pageInfo { hasNextPage }
      }
      headRef {
        target {
          ... on Commit {
            statusCheckRollup {
              contexts(first: 100) {
                nodes {
                  __typename
                  ... on CheckRun { name status conclusion completedAt detailsUrl }
                  ... on StatusContext { context state targetUrl createdAt }
                }
                pageInfo { hasNextPage }
              }
            }
          }
        }
      }
    }
  }
}
`;

function ghJson(args) {
  return JSON.parse(
    execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  );
}

export function assertNoTruncation(nodes, pageInfo, label) {
  if (!Array.isArray(nodes)) throw new Error(`live ${label} payload is malformed`);
  if (pageInfo?.hasNextPage === true) {
    throw new Error(
      `live ${label} collection exceeds one page: re-collect with pagination or bound the review target before submission`
    );
  }
}

export function normalizeCheck(node) {
  if (node.__typename === 'CheckRun') {
    return {
      name: node.name,
      status: node.status,
      conclusion: node.conclusion ?? null,
      completedAt: node.completedAt,
      detailsUrl: node.detailsUrl,
    };
  }
  const terminal = TERMINAL_CHECK_STATES.has(node.state);
  return {
    name: node.context,
    status: terminal ? 'COMPLETED' : node.state,
    conclusion: terminal ? node.state : null,
    completedAt: node.createdAt,
    detailsUrl: node.targetUrl,
  };
}

export function summarizeLiveChecks(checks) {
  if (!Array.isArray(checks) || checks.length === 0) return 'unknown';
  if (checks.some((check) => FAILED_CONCLUSIONS.has(check.conclusion))) return 'failure';
  const allGreen = checks.every(
    (check) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS'
  );
  return allGreen ? 'success' : 'unknown';
}

function parseRepositoryId(repositoryId) {
  const match = repositoryId.match(/^github\.com:([^/]+)\/([^/]+)$/);
  if (!match) throw new Error('review submission requires a github.com repositoryId');
  const [, owner, name] = match;
  return { owner, name };
}

function latestThreadUpdate(thread) {
  const updates = (thread.comments?.nodes ?? [])
    .map((comment) => comment.updatedAt)
    .filter(Boolean);
  if (updates.length === 0) {
    throw new Error(
      `live review thread ${thread.id} carries no comment timestamps; re-collect the canonical input with the same convention before submission`
    );
  }
  return updates.sort().at(-1);
}

export function buildLiveReviewInput(payload, repositoryId, pullRequest, externalEvidence) {
  const pullRequestPayload = payload?.data?.repository?.pullRequest;
  if (!pullRequestPayload) throw new Error('live pull-request payload is incomplete');
  if (!payload?.data?.viewer?.login || !payload?.data?.repository?.viewerPermission) {
    throw new Error('live viewer identity or permission is unavailable');
  }

  assertNoTruncation(
    pullRequestPayload.commits?.nodes,
    pullRequestPayload.commits?.pageInfo,
    'commits'
  );
  assertNoTruncation(
    pullRequestPayload.reviewThreads?.nodes,
    pullRequestPayload.reviewThreads?.pageInfo,
    'review threads'
  );
  const replies = [];
  const threads = [];
  for (const thread of pullRequestPayload.reviewThreads?.nodes ?? []) {
    assertNoTruncation(thread.comments?.nodes, thread.comments?.pageInfo, 'thread comments');
    threads.push({
      id: thread.id,
      isResolved: thread.isResolved === true,
      updatedAt: latestThreadUpdate(thread),
    });
    for (const comment of thread.comments?.nodes ?? []) {
      replies.push({
        id: String(comment.databaseId),
        threadId: thread.id,
        updatedAt: comment.updatedAt,
        author: comment.author?.login ?? 'ghost',
        body: comment.body ?? '',
      });
    }
  }

  const checkContexts = pullRequestPayload.headRef?.target?.statusCheckRollup?.contexts;
  assertNoTruncation(checkContexts?.nodes, checkContexts?.pageInfo, 'check contexts');
  const checks = (checkContexts?.nodes ?? []).map(normalizeCheck);

  const input = {
    schemaVersion: 1,
    kind: 'proto-ui.review-input',
    repositoryId,
    pullRequest,
    baseSha: pullRequestPayload.baseRefOid,
    headSha: pullRequestPayload.headRefOid,
    pullRequestBody: pullRequestPayload.body ?? '',
    commits: (pullRequestPayload.commits?.nodes ?? []).map((node) => ({
      sha: node.commit.oid,
      message: node.commit.messageHeadline ?? '',
    })),
    replies,
    threads,
    checks,
    externalEvidence,
  };
  validateReviewInputSnapshot(input);
  return {
    input,
    viewerLogin: payload.data.viewer.login,
    viewerPermission: payload.data.repository.viewerPermission,
    authorLogin: pullRequestPayload.author?.login,
  };
}

export function collectLiveReviewInput(repositoryId, pullRequest, options = {}) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const externalEvidence = Array.isArray(options.externalEvidence) ? options.externalEvidence : [];
  const raw = ghJson([
    'api',
    'graphql',
    '-f',
    `query=${QUERY}`,
    '-F',
    `owner=${owner}`,
    '-F',
    `name=${name}`,
    '-F',
    `number=${pullRequest}`,
  ]);
  if (raw.errors?.length) {
    throw new Error(`live review-input collection failed: ${raw.errors[0].message}`);
  }
  return buildLiveReviewInput(raw, repositoryId, pullRequest, externalEvidence);
}
