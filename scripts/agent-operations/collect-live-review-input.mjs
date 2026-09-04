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
const SUCCESSFUL_CONCLUSIONS = new Set(['SUCCESS', 'SKIPPED', 'NEUTRAL']);

// GitHub GraphQL schema facts (verified against the live schema):
// - PullRequestReviewThread has no updatedAt; the latest comment updatedAt is authoritative.
// - Commit.statusCheckRollup takes no `first`; contexts are read through statusCheckRollup.contexts(first:).
export const QUERY = `
query($owner: String!, $name: String!, $number: Int!) {
  viewer { login }
  repository(owner: $owner, name: $name) {
    viewerPermission
    pullRequest(number: $number) {
      state
      isDraft
      mergeable
      mergeStateStatus
      changedFiles
      body
      baseRefName
      baseRefOid
      headRefOid
      author { login }
      commits(first: 100) {
        nodes {
          commit {
            oid
            messageHeadline
            statusCheckRollup {
              contexts(first: 100) {
                nodes {
                  __typename
                  ... on CheckRun {
                    name
                    status
                    conclusion
                    completedAt
                    detailsUrl
                    checkSuite {
                      app { slug }
                      repository { nameWithOwner }
                      workflowRun {
                        file { path }
                        workflow { name }
                      }
                    }
                  }
                  ... on StatusContext { context state targetUrl createdAt }
                }
                pageInfo { hasNextPage }
              }
            }
          }
        }
        pageInfo { hasNextPage }
      }
      reviews(first: 100) {
        nodes { id author { login } state commit { oid } submittedAt body }
        pageInfo { hasNextPage }
      }
      comments(first: 100) {
        nodes { id author { login } body updatedAt }
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
      source: node.checkSuite?.app?.slug ?? 'unknown-check-run',
      repository: node.checkSuite?.repository?.nameWithOwner ?? null,
      workflowName: node.checkSuite?.workflowRun?.workflow?.name ?? null,
      workflowPath: node.checkSuite?.workflowRun?.file?.path ?? null,
    };
  }
  const terminal = TERMINAL_CHECK_STATES.has(node.state);
  return {
    name: node.context,
    status: terminal ? 'COMPLETED' : node.state,
    conclusion: terminal ? node.state : null,
    completedAt: node.createdAt,
    detailsUrl: node.targetUrl,
    source: 'status-context',
    repository: null,
    workflowName: null,
    workflowPath: null,
  };
}

function repositoryName(repositoryId) {
  return repositoryId?.match(/^github\.com:([^/]+\/[^/]+)$/)?.[1] ?? null;
}

function repositoryActionsPrefix(repositoryId) {
  const repository = repositoryName(repositoryId);
  return repository ? `https://github.com/${repository}/actions/runs/` : null;
}

export function summarizeLiveChecks(checks, options = {}) {
  if (!Array.isArray(checks) || checks.length === 0) return 'unknown';
  if (checks.some((check) => FAILED_CONCLUSIONS.has(check.conclusion))) return 'failure';
  const allReady = checks.every(
    (check) => check.status === 'COMPLETED' && SUCCESSFUL_CONCLUSIONS.has(check.conclusion)
  );
  const actionsPrefix = repositoryActionsPrefix(options.repositoryId);
  const trustedSource = options.trustedSource ?? 'github-actions';
  const trustedRepository = repositoryName(options.trustedRepositoryId ?? options.repositoryId);
  const trustedCheckNames = new Set(options.trustedCheckNames ?? []);
  const trustedWorkflowNames = new Set(options.trustedWorkflowNames ?? []);
  const trustedWorkflowPaths = new Set(options.trustedWorkflowPaths ?? []);
  const hasTrustedRepositorySuccess = checks.some((check) => {
    if (check.conclusion !== 'SUCCESS' || typeof check.detailsUrl !== 'string') return false;
    const isRepositoryAction = actionsPrefix
      ? check.detailsUrl.startsWith(actionsPrefix)
      : /^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\//.test(check.detailsUrl);
    const nameIsTrusted = trustedCheckNames.size === 0 || trustedCheckNames.has(check.name);
    const workflowIsTrusted =
      trustedWorkflowNames.size === 0 || trustedWorkflowNames.has(check.workflowName);
    const workflowPathIsTrusted =
      trustedWorkflowPaths.size === 0 || trustedWorkflowPaths.has(check.workflowPath);
    return (
      check.source === trustedSource &&
      check.repository === trustedRepository &&
      isRepositoryAction &&
      nameIsTrusted &&
      workflowIsTrusted &&
      workflowPathIsTrusted
    );
  });
  return allReady && hasTrustedRepositorySuccess ? 'success' : 'unknown';
}

export function parseRepositoryId(repositoryId) {
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

export function buildLiveReviewInput(
  payload,
  repositoryId,
  pullRequest,
  externalEvidence,
  changedFilePayload
) {
  const pullRequestPayload = payload?.data?.repository?.pullRequest;
  if (!pullRequestPayload) throw new Error('live pull-request payload is incomplete');
  if (!payload?.data?.viewer?.login || !payload?.data?.repository?.viewerPermission) {
    throw new Error('live viewer identity or permission is unavailable');
  }
  if (
    !Number.isInteger(pullRequestPayload.changedFiles) ||
    pullRequestPayload.changedFiles < 1 ||
    changedFilePayload.length !== pullRequestPayload.changedFiles
  ) {
    throw new Error('live changed-file collection is incomplete');
  }

  assertNoTruncation(
    pullRequestPayload.commits?.nodes,
    pullRequestPayload.commits?.pageInfo,
    'commits'
  );
  assertNoTruncation(
    pullRequestPayload.reviews?.nodes,
    pullRequestPayload.reviews?.pageInfo,
    'reviews'
  );
  assertNoTruncation(
    pullRequestPayload.comments?.nodes,
    pullRequestPayload.comments?.pageInfo,
    'pull-request comments'
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

  const headCommit = pullRequestPayload.commits.nodes.at(-1)?.commit;
  if (!headCommit || headCommit.oid !== pullRequestPayload.headRefOid) {
    throw new Error('live head commit collection does not match the pull-request head');
  }
  const checkContexts = headCommit.statusCheckRollup?.contexts;
  assertNoTruncation(checkContexts?.nodes, checkContexts?.pageInfo, 'check contexts');
  const checks = (checkContexts?.nodes ?? []).map(normalizeCheck);

  const input = {
    schemaVersion: 3,
    kind: 'proto-ui.review-input',
    repositoryId,
    pullRequest,
    pullRequestState: pullRequestPayload.state,
    isDraft: pullRequestPayload.isDraft,
    baseRefName: pullRequestPayload.baseRefName,
    baseSha: pullRequestPayload.baseRefOid,
    headSha: pullRequestPayload.headRefOid,
    pullRequestBody: pullRequestPayload.body ?? '',
    changedFiles: changedFilePayload.map((file) => ({
      path: file.filename,
      previousPath: file.previous_filename ?? null,
      status: file.status,
    })),
    commits: (pullRequestPayload.commits?.nodes ?? []).map((node) => ({
      sha: node.commit.oid,
      message: node.commit.messageHeadline ?? '',
    })),
    reviews: (pullRequestPayload.reviews?.nodes ?? []).map((review) => ({
      id: review.id,
      author: review.author?.login ?? 'ghost',
      state: review.state,
      commitSha: review.commit?.oid ?? null,
      submittedAt: review.submittedAt ?? null,
      body: review.body ?? '',
    })),
    comments: (pullRequestPayload.comments?.nodes ?? []).map((comment) => ({
      id: comment.id,
      author: comment.author?.login ?? 'ghost',
      body: comment.body ?? '',
      updatedAt: comment.updatedAt,
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
    mergeable: pullRequestPayload.mergeable,
    mergeStateStatus: pullRequestPayload.mergeStateStatus,
  };
}

export function submitGitHubReview(
  repositoryId,
  pullRequest,
  { commitId, event, body },
  runner = execFileSync
) {
  const { owner, name } = parseRepositoryId(repositoryId);
  if (!Number.isInteger(pullRequest) || pullRequest < 1) {
    throw new Error('review submission pull request is invalid');
  }
  if (!/^[a-f0-9]{40,64}$/.test(commitId)) {
    throw new Error('review submission commit id is invalid');
  }
  if (!['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].includes(event)) {
    throw new Error('review submission event is invalid');
  }
  if (typeof body !== 'string') throw new Error('review submission body is invalid');

  const response = JSON.parse(
    runner(
      'gh',
      [
        'api',
        '--method',
        'POST',
        `repos/${owner}/${name}/pulls/${pullRequest}/reviews`,
        '--input',
        '-',
      ],
      {
        encoding: 'utf8',
        input: JSON.stringify({ commit_id: commitId, event, body }),
        stdio: ['pipe', 'pipe', 'pipe'],
      }
    )
  );
  if (response.commit_id !== commitId) {
    throw new Error('submitted review commit does not match the inspected head');
  }
  const expectedState = {
    APPROVE: 'APPROVED',
    REQUEST_CHANGES: 'CHANGES_REQUESTED',
    COMMENT: 'COMMENTED',
  }[event];
  if (!['number', 'string'].includes(typeof response.id) || response.state !== expectedState) {
    throw new Error('submitted review receipt is incomplete or has an unexpected state');
  }
  return {
    id: String(response.id),
    nodeId: response.node_id ?? null,
    state: response.state,
    commitId: response.commit_id,
    url: response.html_url ?? null,
  };
}

export function submitGitHubMerge(
  repositoryId,
  pullRequest,
  { headSha, mergeMethod },
  runner = execFileSync
) {
  const { owner, name } = parseRepositoryId(repositoryId);
  if (!Number.isInteger(pullRequest) || pullRequest < 1) {
    throw new Error('merge pull request is invalid');
  }
  if (!/^[a-f0-9]{40,64}$/.test(headSha)) {
    throw new Error('merge head SHA is invalid');
  }
  if (!['merge', 'squash', 'rebase'].includes(mergeMethod)) {
    throw new Error('merge method is invalid');
  }

  let response;
  try {
    response = JSON.parse(
      runner(
        'gh',
        [
          'api',
          '--method',
          'PUT',
          `repos/${owner}/${name}/pulls/${pullRequest}/merge`,
          '--input',
          '-',
        ],
        {
          encoding: 'utf8',
          input: JSON.stringify({ sha: headSha, merge_method: mergeMethod }),
          stdio: ['pipe', 'pipe', 'pipe'],
        }
      )
    );
  } catch (error) {
    try {
      const live = JSON.parse(
        runner('gh', ['api', `repos/${owner}/${name}/pulls/${pullRequest}`], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
      if (
        live.merged === true &&
        live.head?.sha === headSha &&
        /^[a-f0-9]{40,64}$/.test(live.merge_commit_sha ?? '')
      ) {
        throw new Error(
          `merge outcome is ambiguous after live reconciliation: ${live.merge_commit_sha} merged the inspected head, but this invocation and ${mergeMethod} method cannot be attributed; do not retry blindly`
        );
      }
    } catch (reconciliationError) {
      if (
        reconciliationError instanceof Error &&
        reconciliationError.message.startsWith('merge outcome is ambiguous')
      ) {
        throw reconciliationError;
      }
      // The original mutation outcome remains authoritative when reconciliation also fails.
    }
    throw new Error(`merge outcome was not confirmed; do not retry blindly (${error.message})`);
  }

  if (response.merged !== true || !/^[a-f0-9]{40,64}$/.test(response.sha ?? '')) {
    throw new Error(`merge was rejected: ${response.message ?? 'receipt is incomplete'}`);
  }
  return {
    merged: true,
    reconciled: false,
    mergeCommitSha: response.sha,
    headSha,
    mergeMethod,
    message: response.message ?? null,
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
  const filePages = ghJson([
    'api',
    '--paginate',
    '--slurp',
    `repos/${owner}/${name}/pulls/${pullRequest}/files?per_page=100`,
  ]);
  if (!Array.isArray(filePages) || !filePages.every(Array.isArray)) {
    throw new Error('live changed-file collection is malformed');
  }
  const changedFiles = filePages.flat();
  return buildLiveReviewInput(raw, repositoryId, pullRequest, externalEvidence, changedFiles);
}
