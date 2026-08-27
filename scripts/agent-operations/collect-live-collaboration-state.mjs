import { execFileSync } from 'node:child_process';

import { parseRepositoryId } from './collect-live-review-input.mjs';
import {
  collaborationMarker,
  desiredCollaborationStateSatisfied,
  validateCollaborationRequest,
} from './collaboration-runtime.mjs';

const VIEWER_QUERY = `
query ProtoUiCollaborationViewer($owner: String!, $name: String!) {
  viewer { login }
  repository(owner: $owner, name: $name) { viewerPermission }
}`;

const THREAD_QUERY = `
query ProtoUiCollaborationThread($threadId: ID!) {
  node(id: $threadId) {
    ... on PullRequestReviewThread {
      id
      isResolved
      isOutdated
      pullRequest {
        number
        updatedAt
        headRefOid
        state
        author { login }
        repository { nameWithOwner }
      }
      comments(last: 1) {
        nodes { updatedAt }
      }
    }
  }
}`;

const READY_MUTATION = `
mutation ProtoUiMarkReady($pullRequestId: ID!) {
  markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
    pullRequest { id isDraft updatedAt headRefOid url }
  }
}`;

const RESOLVE_THREAD_MUTATION = `
mutation ProtoUiResolveThread($threadId: ID!) {
  resolveReviewThread(input: { threadId: $threadId }) {
    thread { id isResolved }
  }
}`;

function run(runner, args, { input, allowEmpty = false } = {}) {
  const options = {
    encoding: 'utf8',
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  };
  if (input !== undefined) options.input = JSON.stringify(input);
  const output = runner('gh', args, options);
  const text = typeof output === 'string' ? output : (output?.toString('utf8') ?? '');
  if (allowEmpty && text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`GitHub API returned invalid JSON (${error.message})`);
  }
}

function rest(runner, endpoint) {
  return run(runner, ['api', endpoint]);
}

function graphql(runner, query, variables) {
  const args = ['api', 'graphql', '-f', `query=${query}`];
  for (const [key, value] of Object.entries(variables)) args.push('-F', `${key}=${value}`);
  return run(runner, args);
}

function mutationRest(runner, method, endpoint, input) {
  const args = ['api', '--method', method, endpoint];
  if (input !== undefined) args.push('--input', '-');
  return run(runner, args, { input, allowEmpty: true });
}

function asUpperState(value) {
  return typeof value === 'string' ? value.toUpperCase() : value;
}

function sortedLogins(values) {
  return [...new Set((values ?? []).map((value) => value?.login).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b)
  );
}

function sortedNames(values) {
  return [...new Set((values ?? []).map((value) => value?.name ?? value).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b)
  );
}

function repositoryIdFromNameWithOwner(value) {
  return typeof value === 'string' && /^[^/]+\/[^/]+$/.test(value) ? `github.com:${value}` : null;
}

function targetKind(item) {
  return item?.pull_request ? 'pull-request' : 'issue';
}

function verifyNumber(item, number, label) {
  if (item?.number !== number) throw new Error(`${label} response does not match target number`);
}

function viewerState(repositoryId, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const payload = graphql(runner, VIEWER_QUERY, { owner, name });
  const login = payload?.data?.viewer?.login;
  const permission = payload?.data?.repository?.viewerPermission;
  if (typeof login !== 'string' || typeof permission !== 'string') {
    throw new Error('live GitHub viewer identity or repository permission is unavailable');
  }
  return { viewerLogin: login, viewerPermission: permission };
}

function pullRequestState(repositoryId, number, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const pull = rest(runner, `repos/${owner}/${name}/pulls/${number}`);
  verifyNumber(pull, number, 'pull-request');
  return pull;
}

function pullRequestCommitContributors(repositoryId, number, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const pages = run(runner, [
    'api',
    '--paginate',
    '--slurp',
    `repos/${owner}/${name}/pulls/${number}/commits?per_page=100`,
  ]);
  if (!Array.isArray(pages)) {
    throw new Error('pull-request commit pagination returned an invalid shape');
  }
  if (!pages.every((page) => Array.isArray(page))) {
    throw new Error('pull-request commit pagination returned an invalid page');
  }
  const commits = pages.flat();
  if (commits.length === 0) {
    throw new Error('pull-request commit contributor identity is unavailable');
  }

  const logins = [];
  let identityComplete = true;
  for (const commit of commits) {
    if (typeof commit?.sha !== 'string') {
      throw new Error('pull-request commit pagination returned an invalid commit');
    }
    for (const role of ['author', 'committer']) {
      const login = commit?.[role]?.login;
      if (typeof login !== 'string' || login.length === 0) {
        identityComplete = false;
      } else {
        logins.push(login);
      }
    }
  }

  return {
    commitContributorLogins: [...new Set(logins)].sort((left, right) => left.localeCompare(right)),
    commitContributorIdentityComplete: identityComplete,
  };
}

function issueState(repositoryId, number, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const issue = rest(runner, `repos/${owner}/${name}/issues/${number}`);
  verifyNumber(issue, number, 'Issue');
  return issue;
}

function commonCurrent(item, kind, headSha = null) {
  return {
    kind,
    number: item.number,
    nodeId: item.node_id ?? null,
    url: item.html_url ?? null,
    state: asUpperState(item.state),
    authorLogin: item.user?.login ?? null,
    updatedAt: item.updated_at,
    headSha,
  };
}

function desiredLabelsExist(repositoryId, desiredLabels, currentLabels, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const current = new Set(currentLabels);
  for (const label of desiredLabels) {
    if (current.has(label)) continue;
    try {
      const response = rest(runner, `repos/${owner}/${name}/labels/${encodeURIComponent(label)}`);
      if (response?.name !== label) return false;
    } catch {
      return false;
    }
  }
  return true;
}

function compareContainsBase(repositoryId, baseSha, headSha, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const comparison = rest(
    runner,
    `repos/${owner}/${name}/compare/${encodeURIComponent(baseSha)}...${encodeURIComponent(headSha)}`
  );
  return ['ahead', 'identical'].includes(comparison?.status);
}

function markerComment(repositoryId, number, marker, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const pages = run(runner, [
    'api',
    '--paginate',
    '--slurp',
    `repos/${owner}/${name}/issues/${number}/comments?per_page=100`,
  ]);
  if (!Array.isArray(pages)) throw new Error('Issue comment pagination returned an invalid shape');
  const comments = pages.flatMap((page) => (Array.isArray(page) ? page : []));
  const matches = comments.filter(
    (comment) => typeof comment?.body === 'string' && comment.body.includes(marker)
  );
  if (matches.length > 1) throw new Error('multiple comments use the exact collaboration marker');
  const comment = matches[0];
  return comment
    ? {
        id: String(comment.id),
        nodeId: comment.node_id ?? null,
        url: comment.html_url ?? null,
        createdAt: comment.created_at,
        body: comment.body,
      }
    : null;
}

function normalizeWorkflowPath(value) {
  if (typeof value !== 'string') return value;
  return value.startsWith('/') ? value.slice(1) : value;
}

export function collectLiveCollaborationState(request, options = {}) {
  validateCollaborationRequest(request);
  const runner = options.runner ?? execFileSync;
  const observedAt = (options.now ?? (() => new Date()))().toISOString();
  const viewer = viewerState(request.repositoryId, runner);
  const action = request.action;
  let current;

  if (action === 'update-governed-issue-or-pull-request-metadata') {
    const item =
      request.target.kind === 'pull-request'
        ? pullRequestState(request.repositoryId, request.target.number, runner)
        : issueState(request.repositoryId, request.target.number, runner);
    if (request.target.kind === 'issue' && targetKind(item) !== 'issue') {
      throw new Error('live Issue/pull-request kind does not match the exact target');
    }
    const labels = sortedNames(item.labels);
    current = {
      ...commonCurrent(item, request.target.kind, item.head?.sha ?? null),
      title: item.title,
      body: item.body ?? null,
      milestoneNumber: item.milestone?.number ?? null,
      assignees: sortedLogins(item.assignees),
      labels,
      desiredLabelsExist: desiredLabelsExist(
        request.repositoryId,
        request.desired.labels,
        labels,
        runner
      ),
    };
  } else if (action === 'update-pull-request-branch-at-expected-head') {
    const pull = pullRequestState(request.repositoryId, request.target.number, runner);
    current = {
      ...commonCurrent(pull, 'pull-request', pull.head?.sha),
      baseSha: pull.base?.sha,
      containsBaseSha: compareContainsBase(
        request.repositoryId,
        pull.base?.sha,
        pull.head?.sha,
        runner
      ),
      maintainerCanModify: pull.maintainer_can_modify === true,
    };
  } else if (action === 'mark-exact-head-ready-for-review') {
    const pull = pullRequestState(request.repositoryId, request.target.number, runner);
    current = {
      ...commonCurrent(pull, 'pull-request', pull.head?.sha),
      isDraft: pull.draft === true,
    };
  } else if (action === 'request-independent-review') {
    const pull = pullRequestState(request.repositoryId, request.target.number, runner);
    const contributors = pullRequestCommitContributors(
      request.repositoryId,
      request.target.number,
      runner
    );
    current = {
      ...commonCurrent(pull, 'pull-request', pull.head?.sha),
      requestedReviewerLogins: sortedLogins(pull.requested_reviewers),
      ...contributors,
    };
  } else if (action === 'resolve-fixed-review-thread') {
    const payload = graphql(runner, THREAD_QUERY, { threadId: request.target.threadId });
    const thread = payload?.data?.node;
    const pull = thread?.pullRequest;
    if (
      thread?.id !== request.target.threadId ||
      pull?.number !== request.target.number ||
      repositoryIdFromNameWithOwner(pull?.repository?.nameWithOwner) !== request.repositoryId
    ) {
      throw new Error('live review thread does not belong to the exact pull request');
    }
    const latestComment = thread.comments?.nodes?.[0];
    current = {
      kind: 'review-thread',
      number: pull.number,
      nodeId: null,
      url: null,
      state: asUpperState(pull.state),
      authorLogin: pull.author?.login ?? null,
      updatedAt: pull.updatedAt,
      headSha: pull.headRefOid,
      threadId: thread.id,
      threadUpdatedAt: latestComment?.updatedAt ?? null,
      isResolved: thread.isResolved === true,
      isOutdated: thread.isOutdated === true,
    };
  } else if (action === 'rerun-exact-trusted-workflow') {
    const { owner, name } = parseRepositoryId(request.repositoryId);
    const workflow = rest(runner, `repos/${owner}/${name}/actions/runs/${request.target.runId}`);
    if (workflow?.id !== request.target.runId) {
      throw new Error('live workflow response does not match target run');
    }
    current = {
      kind: 'workflow-run',
      runId: workflow.id,
      url: workflow.html_url ?? null,
      updatedAt: workflow.updated_at,
      headSha: workflow.head_sha,
      attempt: workflow.run_attempt,
      workflowName: workflow.name,
      workflowPath: normalizeWorkflowPath(workflow.path),
      headRepositoryId: repositoryIdFromNameWithOwner(workflow.head_repository?.full_name),
      status: workflow.status,
      conclusion: workflow.conclusion,
    };
  } else {
    const item =
      request.target.kind === 'pull-request'
        ? pullRequestState(request.repositoryId, request.target.number, runner)
        : issueState(request.repositoryId, request.target.number, runner);
    if (request.target.kind === 'issue' && targetKind(item) !== 'issue') {
      throw new Error('live comment target kind does not match request');
    }
    current = {
      ...commonCurrent(item, request.target.kind, item.head?.sha ?? null),
      markerComment: markerComment(
        request.repositoryId,
        request.target.number,
        collaborationMarker(request),
        runner
      ),
    };
  }

  return {
    schemaVersion: 1,
    kind: 'proto-ui.live-collaboration-state',
    repositoryId: request.repositoryId,
    action,
    observedAt,
    ...viewer,
    current,
  };
}

function mutationResponse(request, runner) {
  const { owner, name } = parseRepositoryId(request.repositoryId);
  const { action } = request;
  if (action === 'update-governed-issue-or-pull-request-metadata') {
    return mutationRest(runner, 'PATCH', `repos/${owner}/${name}/issues/${request.target.number}`, {
      title: request.desired.title,
      body: request.desired.body,
      milestone: request.desired.milestoneNumber,
      assignees: request.desired.assignees,
      labels: request.desired.labels,
    });
  }
  if (action === 'update-pull-request-branch-at-expected-head') {
    return mutationRest(
      runner,
      'PUT',
      `repos/${owner}/${name}/pulls/${request.target.number}/update-branch`,
      { expected_head_sha: request.target.headSha }
    );
  }
  if (action === 'mark-exact-head-ready-for-review') {
    return graphql(runner, READY_MUTATION, { pullRequestId: request.targetNodeId });
  }
  if (action === 'request-independent-review') {
    return mutationRest(
      runner,
      'POST',
      `repos/${owner}/${name}/pulls/${request.target.number}/requested_reviewers`,
      { reviewers: [request.desired.reviewerLogin] }
    );
  }
  if (action === 'resolve-fixed-review-thread') {
    return graphql(runner, RESOLVE_THREAD_MUTATION, { threadId: request.target.threadId });
  }
  if (action === 'rerun-exact-trusted-workflow') {
    const suffix = request.desired.mode === 'failed-jobs' ? 'rerun-failed-jobs' : 'rerun';
    return mutationRest(
      runner,
      'POST',
      `repos/${owner}/${name}/actions/runs/${request.target.runId}/${suffix}`
    );
  }
  return mutationRest(
    runner,
    'POST',
    `repos/${owner}/${name}/issues/${request.target.number}/comments`,
    { body: `${request.desired.body}\n\n${collaborationMarker(request)}` }
  );
}

function platformObject(request, raw, postState) {
  const current = postState.current;
  let response = raw;
  if (request.action === 'mark-exact-head-ready-for-review') {
    response = raw?.data?.markPullRequestReadyForReview?.pullRequest ?? raw;
  } else if (request.action === 'resolve-fixed-review-thread') {
    response = raw?.data?.resolveReviewThread?.thread ?? raw;
  }
  const comment = current.markerComment;
  const id =
    request.action === 'post-bounded-reconciliation-comment'
      ? (comment?.id ?? response?.id)
      : request.action === 'rerun-exact-trusted-workflow'
        ? String(current.runId)
        : (response?.id ?? current.nodeId ?? current.number);
  return {
    id: id === null || id === undefined ? null : String(id),
    nodeId: response?.node_id ?? response?.id ?? comment?.nodeId ?? current.nodeId ?? null,
    url: response?.html_url ?? response?.url ?? comment?.url ?? current.url ?? null,
    updatedAt: response?.updated_at ?? response?.updatedAt ?? current.updatedAt ?? null,
    headSha: current.headSha ?? null,
    workflowRunId: request.action === 'rerun-exact-trusted-workflow' ? current.runId : null,
    workflowAttempt: request.action === 'rerun-exact-trusted-workflow' ? current.attempt : null,
  };
}

export function applyGitHubCollaborationMutation(request, preState, options = {}) {
  validateCollaborationRequest(request);
  if (desiredCollaborationStateSatisfied(request, preState)) {
    return {
      mutationCount: 0,
      reconciliationCount: 0,
      reconciled: false,
      rawResponse: null,
      platformObject: null,
      postState: preState,
    };
  }
  const runner = options.runner ?? execFileSync;
  const collectState = options.collectState ?? collectLiveCollaborationState;
  let rawResponse;
  try {
    const mutationRequest =
      request.action === 'mark-exact-head-ready-for-review'
        ? { ...request, targetNodeId: preState.current.nodeId }
        : request;
    rawResponse = mutationResponse(mutationRequest, runner);
  } catch (error) {
    let reconciledState;
    try {
      reconciledState = collectState(request, { runner });
    } catch (reconciliationError) {
      throw new Error(
        `${request.action} outcome is unknown and live reconciliation failed; do not retry blindly (${error.message}; ${reconciliationError.message})`
      );
    }
    if (
      request.action === 'post-bounded-reconciliation-comment' &&
      desiredCollaborationStateSatisfied(request, reconciledState)
    ) {
      return {
        mutationCount: 1,
        reconciliationCount: 1,
        reconciled: true,
        rawResponse: null,
        platformObject: platformObject(request, null, reconciledState),
        postState: reconciledState,
      };
    }
    throw new Error(
      `${request.action} outcome is ambiguous after one live reconciliation; do not retry blindly (${error.message})`
    );
  }

  const postState = collectState(request, { runner });
  if (!desiredCollaborationStateSatisfied(request, postState)) {
    throw new Error(
      `${request.action} returned but the desired state was not verified by the single post-write read; do not retry blindly`
    );
  }
  return {
    mutationCount: 1,
    reconciliationCount: 0,
    reconciled: false,
    rawResponse,
    platformObject: platformObject(request, rawResponse, postState),
    postState,
  };
}
