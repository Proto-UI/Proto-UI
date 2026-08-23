import { execFileSync } from 'node:child_process';

const TERMINAL_CHECK_STATES = new Set(['SUCCESS', 'FAILURE', 'ERROR']);
const FAILED_CONCLUSIONS = new Set([
  'FAILURE',
  'ERROR',
  'TIMED_OUT',
  'ACTION_REQUIRED',
  'CANCELLED',
  'STARTUP_FAILURE',
]);

const QUERY = `
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
      }
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          updatedAt
          comments(first: 100) {
            nodes { databaseId author { login } body updatedAt }
          }
        }
      }
      headRef {
        target {
          ... on Commit {
            statusCheckRollup(first: 100) {
              nodes {
                __typename
                ... on CheckRun { name status conclusion completedAt detailsUrl }
                ... on StatusContext { context state targetUrl createdAt }
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

function normalizeCheck(node) {
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

export function collectLiveReviewInput(repositoryId, pullRequest) {
  const { owner, name } = parseRepositoryId(repositoryId);
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
  const pullRequestPayload = raw.data?.repository?.pullRequest;
  if (!pullRequestPayload) throw new Error('live pull-request payload is incomplete');
  const viewerLogin = raw.data?.viewer?.login;
  const viewerPermission = raw.data?.repository?.viewerPermission;
  if (!viewerLogin || !viewerPermission) {
    throw new Error('live viewer identity or permission is unavailable');
  }

  const replies = [];
  const threads = [];
  for (const thread of pullRequestPayload.reviewThreads?.nodes ?? []) {
    threads.push({
      id: thread.id,
      isResolved: thread.isResolved === true,
      updatedAt: thread.updatedAt,
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

  const checks = (pullRequestPayload.headRef?.target?.statusCheckRollup?.nodes ?? []).map(
    normalizeCheck
  );

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
    externalEvidence: [],
  };

  return { input, viewerLogin, viewerPermission, authorLogin: pullRequestPayload.author?.login };
}
