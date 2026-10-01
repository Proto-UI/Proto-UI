import { execFileSync } from 'node:child_process';
import {
  commitActorIdentity,
  latestThreadUpdate,
  MAX_LIVE_RESPONSE_BYTES,
  parseRepositoryId,
} from './collect-live-review-input.mjs';
import {
  authorizeCollaborationMutation,
  collaborationMarker,
  desiredCollaborationStateSatisfied,
  validateCollaborationRequest,
} from './collaboration-runtime.mjs';

const VIEWER_QUERY = `
query ProtoUiCollaborationViewer($owner: String!, $name: String!) {
  viewer { login }
  repository(owner: $owner, name: $name) { viewerPermission }
}`;

const COMMITTER_QUERY = `
query ProtoUiCollaborationCommitter($owner: String!, $name: String!, $oid: GitObjectID!) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
    object(oid: $oid) {
      __typename
      ... on Commit {
        oid
        committer { name email user { login } }
        signature {
          __typename
          ... on GpgSignature { isValid wasSignedByGitHub }
          ... on SshSignature { isValid wasSignedByGitHub }
        }
      }
    }
  }
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
      comments(first: 100) {
        nodes { databaseId updatedAt }
        pageInfo { hasNextPage }
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
    maxBuffer: MAX_LIVE_RESPONSE_BYTES,
    stdio: input === undefined ? ['ignore', 'pipe', 'pipe'] : ['pipe', 'pipe', 'pipe'],
  };
  if (input !== undefined) options.input = JSON.stringify(input);
  let output;
  try {
    output = runner('gh', args, options);
  } catch (error) {
    if (error?.code === 'ENOBUFS') {
      throw new Error(
        `live collaboration response exceeds the documented ${MAX_LIVE_RESPONSE_BYTES}-byte payload bound; bound the collaboration target before mutation`
      );
    }
    throw error;
  }
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

function collectCommitterIdentity(repositoryId, sha, runner) {
  const { owner, name } = parseRepositoryId(repositoryId);
  const payload = graphql(runner, COMMITTER_QUERY, { owner, name, oid: sha });
  const repository = payload?.data?.repository;
  const commit = repository?.object;
  if (
    (payload?.errors?.length ?? 0) > 0 ||
    repositoryIdFromNameWithOwner(repository?.nameWithOwner) !== repositoryId ||
    commit?.__typename !== 'Commit' ||
    commit.oid !== sha
  ) {
    return null;
  }
  return commitActorIdentity(commit.committer, commit.signature, 'committer');
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
    if (typeof commit?.sha !== 'string' || !/^[a-f0-9]{40}$/.test(commit.sha)) {
      throw new Error('pull-request commit pagination returned an invalid commit');
    }
    for (const role of ['author', 'committer']) {
      const login = commit?.[role]?.login;
      if (typeof login !== 'string' || login.length === 0) {
        // REST verification.verified also accepts signatures made by humans.
        // Only exact-commit GitHub attestation may identify a platform committer;
        // it never establishes the identity of an unlinked author.
        const identity =
          role === 'committer' ? collectCommitterIdentity(repositoryId, commit.sha, runner) : null;
        if (typeof identity?.login === 'string' && identity.login.length > 0) {
          logins.push(identity.login);
        } else if (!identity?.platform) {
          identityComplete = false;
        }
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
  if (!Array.isArray(pages) || pages.length === 0 || !pages.every(Array.isArray))
    throw new Error('Issue comment pagination returned an invalid page shape');
  const comments = pages.flat();
  if (
    comments.some(
      (comment) =>
        !comment ||
        typeof comment.body !== 'string' ||
        !(
          (Number.isInteger(comment.id) && comment.id > 0) ||
          (typeof comment.id === 'string' && /^[1-9]\d*$/.test(comment.id))
        )
    )
  )
    throw new Error('Issue comment pagination returned an invalid comment');
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
        authorLogin: comment.user?.login ?? null,
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
    if (!thread || !pull) {
      throw new Error('live review thread response is missing its thread or pull-request node');
    }
    if (thread.id !== request.target.threadId) {
      throw new Error('live review thread response does not match the exact thread target');
    }
    if (
      pull.number !== request.target.number ||
      repositoryIdFromNameWithOwner(pull.repository?.nameWithOwner) !== request.repositoryId
    ) {
      throw new Error('live review thread response does not bind to the exact pull request');
    }
    const threadUpdatedAt = latestThreadUpdate(thread);
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
      threadUpdatedAt,
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
    const input = {};
    if (request.desired.title !== request.expected.title) input.title = request.desired.title;
    if (request.desired.body !== request.expected.body) input.body = request.desired.body;
    if (request.desired.milestoneNumber !== request.expected.milestoneNumber) {
      input.milestone = request.desired.milestoneNumber;
    }
    if (JSON.stringify(request.desired.assignees) !== JSON.stringify(request.expected.assignees)) {
      input.assignees = request.desired.assignees;
    }
    if (JSON.stringify(request.desired.labels) !== JSON.stringify(request.expected.labels)) {
      input.labels = request.desired.labels;
    }
    return mutationRest(
      runner,
      'PATCH',
      `repos/${owner}/${name}/issues/${request.target.number}`,
      input
    );
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

function verifyGraphqlMutationResponse(request, raw) {
  const ready = request.action === 'mark-exact-head-ready-for-review';
  if (!ready && request.action !== 'resolve-fixed-review-thread') return;
  // HTTP success is not GraphQL mutation success: partial data can accompany
  // errors. A later matching state cannot attribute this invocation's write.
  if (raw?.errors !== undefined && (!Array.isArray(raw.errors) || raw.errors.length > 0)) {
    throw new Error('GraphQL mutation response contains errors or an invalid errors field');
  }
  const object = ready
    ? raw?.data?.markPullRequestReadyForReview?.pullRequest
    : raw?.data?.resolveReviewThread?.thread;
  const targetNodeId = ready ? request.targetNodeId : request.target.threadId;
  if (
    typeof object?.id !== 'string' ||
    object.id.length === 0 ||
    object.id !== targetNodeId ||
    (ready
      ? object.isDraft !== false || object.headRefOid !== request.target.headSha
      : object.isResolved !== true)
  ) {
    throw new Error(
      'GraphQL mutation response does not acknowledge the exact target and desired state'
    );
  }
}

function platformObject(request, raw, postState) {
  const current = postState.current;
  let response = raw;
  if (request.action === 'mark-exact-head-ready-for-review') {
    response = raw.data.markPullRequestReadyForReview.pullRequest;
  } else if (request.action === 'resolve-fixed-review-thread') {
    response = raw.data.resolveReviewThread.thread;
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

function waitSynchronously(delayMs) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function collectVerifiedPostWriteState(request, runner, collectState, options) {
  const isAsynchronousBranchUpdate =
    request.action === 'update-pull-request-branch-at-expected-head';
  const isAsynchronousWorkflowRerun = request.action === 'rerun-exact-trusted-workflow';
  const isAsynchronousMutation = isAsynchronousBranchUpdate || isAsynchronousWorkflowRerun;
  const maxAttempts = isAsynchronousMutation ? (options.asyncVerificationAttempts ?? 12) : 1;
  const delayMs = options.asyncVerificationDelayMs ?? 1_000;
  const wait = options.wait ?? waitSynchronously;
  let postState;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    postState = collectState(request, { runner });
    if (desiredCollaborationStateSatisfied(request, postState)) {
      if (isAsynchronousWorkflowRerun && postState.current.attempt !== request.target.attempt + 1)
        throw new Error(
          'workflow rerun advanced beyond the attributable next attempt; do not retry blindly'
        );
      return postState;
    }
    const current = postState.current;
    const canStillConverge = isAsynchronousBranchUpdate
      ? current.state === 'OPEN' && current.baseSha === request.target.baseSha
      : isAsynchronousWorkflowRerun &&
        current.runId === request.target.runId &&
        current.headSha === request.target.headSha &&
        current.workflowName === request.target.workflowName &&
        current.workflowPath === request.target.workflowPath &&
        current.headRepositoryId === request.repositoryId &&
        current.attempt === request.target.attempt;
    if (!canStillConverge || attempt === maxAttempts) break;
    wait(delayMs);
  }

  const verification = isAsynchronousMutation
    ? 'bounded post-write verification polling'
    : 'the single post-write read';
  throw new Error(
    `${request.action} returned but the desired state was not verified by ${verification}; do not retry blindly`
  );
}

export class CollaborationPreWriteRejection extends Error {
  constructor(reason, liveState) {
    super(`desired state was not verified before mutation; do not retry blindly (${reason})`);
    this.name = 'CollaborationPreWriteRejection';
    this.liveState = structuredClone(liveState);
  }
}

function noWriteResult(postState) {
  return {
    mutationCount: 0,
    reconciliationCount: 0,
    reconciled: false,
    rawResponse: null,
    platformObject: null,
    postState,
  };
}

function verifyCommentProvenance(rawResponse, latestState, postState) {
  const comment = postState.current.markerComment;
  const createdAt = Date.parse(comment?.createdAt);
  // GitHub comment timestamps have second precision. The returned object ID,
  // not this time window, binds a successful response to this invocation.
  const earliest = Math.floor(Date.parse(latestState.observedAt) / 1000) * 1000;
  if (
    !comment?.id ||
    rawResponse?.id === undefined ||
    String(rawResponse.id) !== comment.id ||
    rawResponse.user?.login?.toLowerCase() !== latestState.viewerLogin.toLowerCase() ||
    comment.authorLogin?.toLowerCase() !== latestState.viewerLogin.toLowerCase() ||
    rawResponse.created_at !== comment.createdAt ||
    !Number.isFinite(createdAt) ||
    createdAt < earliest ||
    createdAt > Date.parse(postState.observedAt)
  ) {
    throw new Error(
      'comment response provenance does not match the live object; do not retry blindly'
    );
  }
}

export function applyGitHubCollaborationMutation(request, preState, options = {}) {
  validateCollaborationRequest(request);
  const runner = options.runner ?? execFileSync;
  const collectState = options.collectState ?? collectLiveCollaborationState;
  let rawResponse;
  // Every admitted action reuses the complete authorization gate on the last
  // live read. GitHub does not provide atomic preconditions for every endpoint;
  // the remaining read-to-write interval is not a server-side CAS guarantee.
  const context = options.authorizationContext;
  if (!context || typeof context !== 'object')
    throw new Error('mutation-boundary execution authorization context is required');
  const authorizeState = (liveState) =>
    authorizeCollaborationMutation({
      request,
      liveState,
      executionMode: context.executionMode,
      executionModeSource: context.executionModeSource,
      policy: context.policy,
      selfAssessment: context.selfAssessment ?? null,
    });
  const beforeDecision = authorizeState(preState);
  if (!beforeDecision.allowed)
    throw new CollaborationPreWriteRejection(beforeDecision.reason, preState);
  if (beforeDecision.outcome === 'no-op') return noWriteResult(preState);
  const latestState = collectState(request, { runner });
  const current = latestState.current ?? {};
  const preCurrent = preState.current ?? {};
  const decision = authorizeState(latestState);
  if (!decision.allowed) throw new CollaborationPreWriteRejection(decision.reason, latestState);
  if (
    latestState.viewerLogin.toLowerCase() !== preState.viewerLogin.toLowerCase() ||
    latestState.viewerPermission !== preState.viewerPermission ||
    (current.nodeId ?? null) !== (preCurrent.nodeId ?? null) ||
    (current.authorLogin?.toLowerCase() ?? null) !==
      (preCurrent.authorLogin?.toLowerCase() ?? null) ||
    (request.action === 'request-independent-review' &&
      JSON.stringify(current.commitContributorLogins) !==
        JSON.stringify(preCurrent.commitContributorLogins))
  ) {
    throw new CollaborationPreWriteRejection(
      'live actor, permission, target or contributor identity changed',
      latestState
    );
  }

  if (decision.outcome === 'no-op') return noWriteResult(latestState);

  try {
    const mutationRequest =
      request.action === 'mark-exact-head-ready-for-review'
        ? { ...request, targetNodeId: preState.current.nodeId }
        : request;
    rawResponse = mutationResponse(mutationRequest, runner);
    verifyGraphqlMutationResponse(mutationRequest, rawResponse);
  } catch (error) {
    try {
      collectState(request, { runner });
    } catch (reconciliationError) {
      throw new Error(
        `${request.action} outcome is unknown and live reconciliation failed; do not retry blindly (${error.message}; ${reconciliationError.message})`
      );
    }
    // A deterministic request marker proves a matching live object, not which
    // invocation wrote it. Even the same credential and timestamp can belong
    // to a concurrent runner. Never claim an applied receipt after a lost or
    // invalid acknowledgment; the one reconciliation is read-only and never retries.
    throw new Error(
      `${request.action} outcome is ambiguous after one live reconciliation; do not retry blindly (${error.message})`
    );
  }

  let postState;
  try {
    postState = collectVerifiedPostWriteState(request, runner, collectState, options);
  } catch (error) {
    // The write reached GitHub but verification found a concurrent change.
    // One purpose-bound request may attempt at most its single authorized
    // mutation (PR509-COLLAB-MUTATION-COUNT-001): reconciliation here stays
    // read-only, and the raced target is reported rather than implicitly
    // compensated. Undoing the raced write requires a separately authorized
    // exact-target request.
    if (
      !['resolve-fixed-review-thread', 'mark-exact-head-ready-for-review'].includes(request.action)
    ) {
      throw error;
    }
    let racedSummary = 'live reconciliation after the race failed';
    try {
      const raced = collectState(request, { runner });
      racedSummary = `live state after the race: ${JSON.stringify(raced.current ?? null)}`;
    } catch {
      // The original verification failure governs.
    }
    const failure = new Error(
      `${error.message} The single authorized mutation was not compensated; ${racedSummary}. ` +
        'Inspect the raced target and issue a separately authorized exact-target request if compensation is needed.'
    );
    failure.raced = true;
    throw failure;
  }
  if (request.action === 'post-bounded-reconciliation-comment')
    verifyCommentProvenance(rawResponse, latestState, postState);

  return {
    mutationCount: 1,
    reconciliationCount: 0,
    reconciled: false,
    rawResponse,
    platformObject: platformObject(request, rawResponse, postState),
    postState,
  };
}
