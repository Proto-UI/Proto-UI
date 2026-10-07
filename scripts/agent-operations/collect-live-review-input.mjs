import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { canonicalReplyId, collectReviewSnapshot, QUERY } from './review-pagination.mjs';
export { QUERY };
import { ownerAuthorizationAllows } from './owner-authorization.mjs';
import {
  assertModelTraceDisclosure,
  assertModelTraceFresh,
  renderModelTraceDisclosure,
} from './modeltrace.mjs';
import {
  authorizePullRequestMerge,
  authorizeReviewSubmission,
  computeReviewInputDigest,
  renderReviewBody,
  isExternalPreviewAuthorizationFailure,
  reviewerPermissionSubjects,
  validateReviewInputSnapshot,
  validateReviewPacket,
  validatePublishedReviewPacket,
} from './review-runtime.mjs';

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

// Governed payload bound for one live collection response. Node's incidental
// 1 MiB child-process stdout default previously killed collection with an
// unattributed ENOBUFS on eligible pull requests (PR509-LIVE-INPUT-BUFFER-001:
// PR #509's paginated changed-file JSON alone is over 1 MiB). The collector
// must consume the complete canonical input for an eligible target or fail on
// this explicit documented bound, never on an implicit buffer ceiling.
export const MAX_LIVE_RESPONSE_BYTES = 64 * 1024 * 1024;

function ghJson(args, runner = execFileSync) {
  let stdout;
  try {
    stdout = runner('gh', args, {
      encoding: 'utf8',
      maxBuffer: MAX_LIVE_RESPONSE_BYTES,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    if (error?.code === 'ENOBUFS') {
      throw new Error(
        `live collection response exceeds the documented ${MAX_LIVE_RESPONSE_BYTES}-byte payload bound; bound the review target before submission`
      );
    }
    throw error;
  }
  return JSON.parse(stdout);
}

function assertConnectionShape(nodes, pageInfo, label) {
  if (!Array.isArray(nodes)) throw new Error(`live ${label} payload is malformed`);
  if (typeof pageInfo?.hasNextPage !== 'boolean')
    throw new Error(`live ${label} pagination payload is malformed`);
}

export function assertNoTruncation(nodes, pageInfo, label) {
  assertConnectionShape(nodes, pageInfo, label);
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
      providerId: node.checkSuite?.app?.id ?? null,
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
    source:
      node.creator?.login === 'vercel' && node.creator?.__typename === 'Bot'
        ? 'vercel'
        : 'status-context',
    providerId: null,
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
  const ciChecks = checks.filter((check) => !isExternalPreviewAuthorizationFailure(check));
  if (ciChecks.some((check) => FAILED_CONCLUSIONS.has(check.conclusion))) return 'failure';
  const allReady = ciChecks.every(
    (check) => check.status === 'COMPLETED' && SUCCESSFUL_CONCLUSIONS.has(check.conclusion)
  );
  const actionsPrefix = repositoryActionsPrefix(options.repositoryId);
  const trustedSource = options.trustedSource ?? 'github-actions';
  const trustedRepository = repositoryName(options.trustedRepositoryId ?? options.repositoryId);
  const trustedCheckNames = new Set(options.trustedCheckNames ?? []);
  const trustedWorkflowNames = new Set(options.trustedWorkflowNames ?? []);
  const trustedWorkflowPaths = new Set(options.trustedWorkflowPaths ?? []);
  const trustedChecks = checks.filter((check) => {
    if (typeof check.detailsUrl !== 'string') return false;
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
  if (
    trustedChecks.length === 0 ||
    (trustedCheckNames.size > 0 &&
      [...trustedCheckNames].some(
        (expectedName) => !trustedChecks.some((check) => check.name === expectedName)
      ))
  ) {
    return 'unknown';
  }
  return allReady && trustedChecks.some((check) => check.conclusion === 'SUCCESS')
    ? 'success'
    : 'unknown';
}

export function summarizeLiveDco(checks, options = {}) {
  if (!Array.isArray(checks) || checks.length === 0) return 'unknown';
  const trustedRepository = repositoryName(options.trustedRepositoryId ?? options.repositoryId);
  const trusted = checks.filter(
    (check) =>
      check.name === options.trustedCheckName &&
      check.source === options.trustedSource &&
      check.providerId === options.trustedProviderId &&
      check.repository === trustedRepository &&
      check.detailsUrl === options.trustedDetailsUrl &&
      check.workflowName === null &&
      check.workflowPath === null
  );
  if (trusted.length === 0) return 'unknown';
  if (trusted.some((check) => FAILED_CONCLUSIONS.has(check.conclusion))) return 'failure';
  return trusted.every((check) => check.status === 'COMPLETED' && check.conclusion === 'SUCCESS')
    ? 'success'
    : 'unknown';
}

export function parseRepositoryId(repositoryId) {
  const match = repositoryId.match(/^github\.com:([^/]+)\/([^/]+)$/);
  if (!match) throw new Error('review submission requires a github.com repositoryId');
  const [, owner, name] = match;
  return { owner, name };
}

export function latestThreadUpdate(thread) {
  assertNoTruncation(thread.comments?.nodes, thread.comments?.pageInfo, 'thread comments');
  const updates = thread.comments.nodes.map((comment) => comment?.updatedAt);
  if (updates.length === 0) {
    throw new Error(
      `live review thread ${thread.id} carries no comment timestamps; re-collect before resolution`
    );
  }
  const timestamp = /^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})$/;
  if (
    updates.some(
      (value) =>
        typeof value !== 'string' || !timestamp.test(value) || !Number.isFinite(Date.parse(value))
    )
  ) {
    throw new Error(`live review thread ${thread.id} carries invalid comment timestamps`);
  }
  return updates.sort((left, right) => Date.parse(left) - Date.parse(right)).at(-1);
}

// GitHub attests its own platform-generated commits (web merges, update-branch
// merges, and other web-flow writes) with a valid signature made by GitHub
// itself. Such a committer has no account login, but it is not an unresolved
// human identity either: the canonical model records the verified platform
// identity explicitly instead of leaving a bare null that fails closed
// (PR509-CONTRIBUTOR-IDENTITY-001). A human commit without a linked account
// keeps platform: null and still fails closed.
export const GITHUB_WEB_FLOW_PLATFORM = {
  kind: 'github-web-flow',
  attestation: 'valid-github-signature',
};

// A commit signature attests the actor that created the commit object:
// the committer. The author block is metadata the committer supplies, so a
// GitHub-valid commit signature can only identify the committer as a
// verified platform actor; promoting the author from the same attestation
// would turn an unattested name/email claim into a trusted identity
// (PR509-PLATFORM-AUTHOR-IDENTITY-008).
export function commitActorIdentity(actor, signature, role) {
  if (role !== 'author' && role !== 'committer') {
    throw new Error('commit actor role must be author or committer');
  }
  const login = actor?.user?.login ?? null;
  const platform =
    role === 'committer' &&
    login === null &&
    actor?.name === 'GitHub' &&
    actor?.email === 'noreply@github.com' &&
    signature?.isValid === true &&
    signature?.wasSignedByGitHub === true
      ? structuredClone(GITHUB_WEB_FLOW_PLATFORM)
      : null;
  return {
    login,
    name: actor?.name ?? '',
    email: actor?.email ?? '',
    platform,
  };
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
  if (!pullRequestPayload.author?.login) {
    throw new Error('live pull-request author identity is unavailable');
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
        id: canonicalReplyId(comment),
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
    schemaVersion: 5,
    kind: 'proto-ui.review-input',
    repositoryId,
    pullRequest,
    pullRequestState: pullRequestPayload.state,
    pullRequestAuthor: pullRequestPayload.author.login,
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
      message: node.commit.message ?? '',
      author: commitActorIdentity(node.commit.author, node.commit.signature, 'author'),
      committer: commitActorIdentity(node.commit.committer, node.commit.signature, 'committer'),
    })),
    reviews: (pullRequestPayload.reviews?.nodes ?? []).map((review) => ({
      id: review.id,
      author: review.author?.login ?? null,
      state: review.state,
      commitSha: review.commit?.oid ?? null,
      submittedAt: review.submittedAt ?? null,
      body: review.body ?? '',
    })),
    reviewerPermissions: [],
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
    viewerCanMergeAsAdmin:
      typeof pullRequestPayload.viewerCanMergeAsAdmin === 'boolean'
        ? pullRequestPayload.viewerCanMergeAsAdmin
        : null,
    authorLogin: input.pullRequestAuthor,
    mergeable: pullRequestPayload.mergeable,
    mergeStateStatus: pullRequestPayload.mergeStateStatus,
  };
}

export function authorizeLiveReviewSubmission(context, live) {
  const policy = context.policy;
  return authorizeReviewSubmission({
    packet: context.packet,
    input: context.input,
    liveInput: live.input,
    executionMode: context.executionMode,
    executionModeSource: context.executionModeSource,
    authorizationId: context.authorizationId,
    ownerAuthorization: context.ownerAuthorization,
    policy,
    selfAssessment: context.selfAssessment,
    priorPacket: context.priorPacket ?? null,
    modelTrace: context.modelTrace,
    modelTraceContext: context.modelTraceContext,
    credentialCanReview: ['ADMIN', 'MAINTAIN', 'WRITE'].includes(live.viewerPermission),
    reviewer: live.viewerLogin,
    ciConclusion: summarizeLiveChecks(live.input.checks, {
      repositoryId: context.packet.repositoryId,
      trustedRepositoryId: policy?.trustedCiEvidence?.repositoryId,
      trustedSource: policy?.trustedCiEvidence?.source,
      trustedCheckNames: policy?.trustedCiEvidence?.checkNames,
      trustedWorkflowNames: policy?.trustedCiEvidence?.workflowNames,
      trustedWorkflowPaths: policy?.trustedCiEvidence?.workflowPaths,
    }),
    dcoConclusion: summarizeLiveDco(live.input.checks, {
      repositoryId: context.packet.repositoryId,
      trustedRepositoryId: policy?.trustedDcoEvidence?.repositoryId,
      trustedCheckName: policy?.trustedDcoEvidence?.checkName,
      trustedSource: policy?.trustedDcoEvidence?.source,
      trustedProviderId: policy?.trustedDcoEvidence?.providerId,
      trustedDetailsUrl: policy?.trustedDcoEvidence?.detailsUrl,
    }),
  });
}

function reviewBoundaryPublicationDelta(context, live, event, body) {
  const known = new Set(context.input.reviews.map((review) => review.id));
  const state = { APPROVE: 'APPROVED', REQUEST_CHANGES: 'CHANGES_REQUESTED', COMMENT: 'COMMENTED' }[
    event
  ];
  const matches = live.input.reviews.filter(
    (review) =>
      !known.has(review.id) &&
      review.author?.toLowerCase() === context.actor.toLowerCase() &&
      review.commitSha === context.packet.headSha &&
      review.state === state &&
      review.body === body
  );
  if (!matches.length) return { live, duplicate: false };
  const ids = new Set(matches.map((review) => review.id));
  const input = structuredClone(live.input);
  input.reviews = input.reviews.filter((review) => !ids.has(review.id));
  if (state === 'APPROVED') {
    const priorPermissions = new Set(
      context.input.reviewerPermissions.map((permission) => permission.login.toLowerCase())
    );
    input.reviewerPermissions = input.reviewerPermissions.filter(
      (permission) =>
        permission.login.toLowerCase() !== context.actor.toLowerCase() ||
        priorPermissions.has(permission.login.toLowerCase())
    );
  }
  if (computeReviewInputDigest(input) !== computeReviewInputDigest(context.input))
    throw Error('live changes exceed the exact review publication delta; no POST attempted');
  return { live: { ...live, input }, duplicate: true };
}

export function submitGitHubReview(
  repositoryId,
  pullRequest,
  { commitId, event, body },
  runner = execFileSync,
  {
    reviewerLogin = null,
    invocationId = `${commitId}:${event}:${body}`,
    modelTrace,
    modelTraceContext,
    authorizationContext = null,
  } = {}
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
  if (typeof reviewerLogin !== 'string' || reviewerLogin.length === 0)
    throw new Error('review submission requires the verified reviewer identity');
  assertModelTraceFresh(modelTrace, modelTraceContext, { repositoryId });
  assertModelTraceDisclosure(body, modelTrace);

  if (authorizationContext !== null) {
    const context = authorizationContext;
    if (
      !context ||
      Array.isArray(context) ||
      context.packet?.repositoryId !== repositoryId ||
      context.input?.repositoryId !== repositoryId ||
      context.packet?.pullRequest !== pullRequest ||
      context.input?.pullRequest !== pullRequest ||
      context.packet?.headSha !== commitId ||
      context.input?.headSha !== commitId ||
      context.packet?.recommendedAction !== event ||
      context.actor !== reviewerLogin ||
      !['ADMIN', 'MAINTAIN', 'WRITE'].includes(context.viewerPermission) ||
      renderReviewBody(context.packet) !== body
    )
      throw Error('review authorization context binding is invalid; no POST attempted');
    validateReviewInputSnapshot(context.input);
    validateReviewPacket(context.packet, context.input);
    const finalLive = collectLiveReviewInput(repositoryId, pullRequest, {
      runner,
      externalEvidence: context.externalEvidence,
    });
    if (
      finalLive.viewerLogin !== context.actor ||
      finalLive.viewerPermission !== context.viewerPermission
    )
      throw Error('review identity or permission changed at the final boundary; no POST attempted');
    const publicationDelta = reviewBoundaryPublicationDelta(context, finalLive, event, body);
    const finalAuthorization = authorizeLiveReviewSubmission(context, publicationDelta.live);
    if (finalAuthorization.duplicate || (publicationDelta.duplicate && finalAuthorization.allowed))
      return { status: 'duplicate', invocationId, commitId, event, reconciled: false };
    if (!finalAuthorization.allowed)
      throw Error(
        'review eligibility changed at the final boundary: ' +
          finalAuthorization.reason +
          '; no POST attempted'
      );
  }

  const expectedState = {
    APPROVE: 'APPROVED',
    REQUEST_CHANGES: 'CHANGES_REQUESTED',
    COMMENT: 'COMMENTED',
  }[event];
  const postArgs = [
    'api',
    '--method',
    'POST',
    `repos/${owner}/${name}/pulls/${pullRequest}/reviews`,
    '--input',
    '-',
  ];
  assertModelTraceFresh(modelTrace, modelTraceContext, { repositoryId });
  try {
    const response = JSON.parse(
      runner('gh', postArgs, {
        encoding: 'utf8',
        input: JSON.stringify({ commit_id: commitId, event, body }),
        // Same governed output boundary as every other live call: a large
        // review echo must surface as a documented payload bound, not as an
        // unattributed ENOBUFS from an implicit 1 MiB ceiling.
        maxBuffer: MAX_LIVE_RESPONSE_BYTES,
        stdio: ['pipe', 'pipe', 'pipe'],
      })
    );
    // Validation is still post-write: an unusable successful response is an
    // unknown outcome, just like a lost response, and must never invite a retry.
    if (!response || typeof response !== 'object' || Array.isArray(response)) {
      throw new Error('submitted review receipt is incomplete or has an unexpected shape');
    }
    if (response.commit_id !== commitId) {
      throw new Error('submitted review commit does not match the inspected head');
    }
    const validId =
      (Number.isInteger(response.id) && response.id > 0) ||
      (typeof response.id === 'string' && /^[1-9]\d*$/.test(response.id));
    if (!validId || response.state !== expectedState) {
      throw new Error('submitted review receipt is incomplete or has an unexpected state');
    }
    if (
      response.body !== body ||
      typeof response.user?.login !== 'string' ||
      response.user.login.toLowerCase() !== reviewerLogin.toLowerCase()
    )
      throw new Error(
        'submitted review provenance does not match the acting reviewer and exact body'
      );
    return reviewReceipt(response, invocationId, false);
  } catch (submissionError) {
    const reconciliationArgs = [
      'api',
      '--method',
      'GET',
      '--paginate',
      '--slurp',
      `repos/${owner}/${name}/pulls/${pullRequest}/reviews?per_page=100`,
    ];
    try {
      const reviewPages = JSON.parse(
        runner('gh', reconciliationArgs, {
          encoding: 'utf8',
          // Same governed output boundary as every other live call; the
          // reconciliation path must not fall back to an implicit buffer
          // ceiling (PR509-REVIEW-RECONCILIATION-BUFFER-007).
          maxBuffer: MAX_LIVE_RESPONSE_BYTES,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      );
      if (!Array.isArray(reviewPages) || !reviewPages.every(Array.isArray)) {
        throw new Error('review pagination returned an invalid page shape');
      }
      // A matching review from the same credential can belong to another
      // invocation. invocationId is local correlation metadata, not a token
      // sent to GitHub, so this read cannot recover an applied receipt.
    } catch {
      // Preserve the explicit unknown outcome below; never retry the write.
    }
    return {
      status: 'unknown',
      reconciled: false,
      invocationId,
      commitId,
      event,
      error: submissionError instanceof Error ? submissionError.message : String(submissionError),
    };
  }
}

function reviewReceipt(response, invocationId, reconciled) {
  return {
    status: 'applied',
    reconciled,
    invocationId,
    id: String(response.id),
    nodeId: response.node_id ?? null,
    state: response.state,
    commitId: response.commit_id,
    url: response.html_url ?? null,
  };
}

function waitForMergeRead(delayMs) {
  if (delayMs > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

class MergeHttpReadError extends Error {
  constructor(status, headers) {
    super(`GitHub merge verification GET returned HTTP ${status}`);
    this.status = status;
    this.headers = headers;
  }
}

function parseMergeReadResponse(output) {
  const text = String(output);
  const boundary = /\r?\n\r?\n/.exec(text);
  if (!boundary || boundary.index > 65_536)
    throw new SyntaxError('merge verification HTTP headers are malformed');
  const lines = text.slice(0, boundary.index).split(/\r?\n/);
  const statusLine = /^HTTP\/\d(?:\.\d)? ([1-5]\d{2})(?: [^\r\n]*)?$/.exec(lines.shift());
  if (!statusLine) throw new SyntaxError('merge verification HTTP status is malformed');
  const headers = Object.create(null);
  for (const line of lines) {
    const header = /^([!#$%&'*+.^_`|~\da-z-]+):[ \t]*([^\r\n]*)$/i.exec(line);
    if (!header) throw new SyntaxError('merge verification HTTP header is malformed');
    const name = header[1].toLowerCase();
    if (['retry-after', 'x-ratelimit-remaining', 'x-ratelimit-reset'].includes(name)) {
      if (Object.hasOwn(headers, name))
        throw new SyntaxError('merge verification timing header is duplicated');
      headers[name] = header[2].trim();
    }
  }
  const status = Number(statusLine[1]);
  if (status !== 200) throw new MergeHttpReadError(status, headers);
  return text.slice(boundary.index + boundary[0].length);
}

function mergeRateLimitDelay(error, attempt, now) {
  const integerHeader = (name) => {
    const value = error.headers[name];
    if (!/^\d+$/.test(value ?? '') || !Number.isSafeInteger(Number(value)))
      throw new Error(`rate-limit ${name} is missing or invalid`);
    return Number(value);
  };
  if (Object.hasOwn(error.headers, 'retry-after')) return integerHeader('retry-after') * 1000;
  if (error.headers['x-ratelimit-remaining'] === '0') {
    const reset = integerHeader('x-ratelimit-reset') * 1000;
    const current = now();
    if (!Number.isFinite(current)) throw new Error('rate-limit observation time is invalid');
    return Math.max(1000, reset - current + 1000);
  }
  // Without explicit timing, GitHub requires at least one minute, then
  // exponential backoff. Never fit an excessive delay by shortening it.
  return 60_000 * 2 ** (attempt - 1);
}

function isTransientMergeRead(error) {
  if (error instanceof MergeHttpReadError) return [408, 500, 502, 503, 504].includes(error.status);
  if (error instanceof SyntaxError || ['EACCES', 'EPERM', 'ENOBUFS'].includes(error?.code))
    return false;
  const detail = `${error?.stderr ?? ''}\n${error?.message ?? ''}`;
  if (/HTTP (?:401|403|404|429)\b/i.test(detail)) return false;
  return (
    /HTTP (?:408|500|502|503|504)\b/i.test(detail) ||
    ['ETIMEDOUT', 'ECONNRESET', 'EAI_AGAIN', 'ECONNREFUSED'].includes(error?.code) ||
    /TLS handshake timeout|i\/o timeout|connection reset by peer|unexpected EOF/i.test(detail)
  );
}

function isGitHubMergeTime(value) {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 19) === value.slice(0, 19)
  );
}

export function authorizeLivePullRequestMerge(context, live) {
  const { policy } = context;
  return authorizePullRequestMerge({
    packet: context.packet,
    publishedPacket: context.publishedPacket,
    input: context.input,
    liveInput: live.input,
    executionMode: context.executionMode,
    executionModeSource: context.executionModeSource,
    authorizationId: context.authorizationId,
    ownerAuthorization: context.ownerAuthorization,
    policy,
    selfAssessment: context.selfAssessment,
    modelTrace: context.modelTrace,
    modelTraceContext: context.modelTraceContext,
    credentialCanMerge: ['ADMIN', 'MAINTAIN', 'WRITE'].includes(live.viewerPermission),
    credentialPermission: live.viewerPermission,
    credentialCanBypass: live.viewerCanMergeAsAdmin,
    actor: live.viewerLogin,
    ciConclusion: summarizeLiveChecks(live.input.checks, {
      repositoryId: context.packet.repositoryId,
      trustedRepositoryId: policy?.trustedCiEvidence?.repositoryId,
      trustedSource: policy?.trustedCiEvidence?.source,
      trustedCheckNames: policy?.trustedCiEvidence?.checkNames,
      trustedWorkflowNames: policy?.trustedCiEvidence?.workflowNames,
      trustedWorkflowPaths: policy?.trustedCiEvidence?.workflowPaths,
    }),
    dcoConclusion: summarizeLiveDco(live.input.checks, {
      repositoryId: context.packet.repositoryId,
      trustedRepositoryId: policy?.trustedDcoEvidence?.repositoryId,
      trustedCheckName: policy?.trustedDcoEvidence?.checkName,
      trustedSource: policy?.trustedDcoEvidence?.source,
      trustedProviderId: policy?.trustedDcoEvidence?.providerId,
      trustedDetailsUrl: policy?.trustedDcoEvidence?.detailsUrl,
    }),
    mergeable: live.mergeable,
    mergeStateStatus: live.mergeStateStatus,
  });
}

export function submitGitHubMerge(
  repositoryId,
  pullRequest,
  {
    headSha,
    expectedBaseSha,
    baseRefName,
    mergeMethod,
    authorizationId = 'explicit-current-user',
    authorizationContext,
  },
  runner = execFileSync,
  options = {}
) {
  const { owner, name } = parseRepositoryId(repositoryId);
  if (!Number.isInteger(pullRequest) || pullRequest < 1)
    throw new Error('merge pull request is invalid');
  if (!/^[a-f0-9]{40,64}$/.test(headSha ?? '')) throw new Error('merge head SHA is invalid');
  if (!/^[a-f0-9]{40,64}$/.test(expectedBaseSha ?? ''))
    throw new Error('expected merge base SHA is required');
  if (typeof baseRefName !== 'string' || baseRefName.length === 0)
    throw new Error('merge base ref is required');
  if (mergeMethod !== 'squash') throw new Error('merge method must be squash');

  const maxAttempts = options.verificationAttempts ?? 12;
  const delayMs = options.verificationDelayMs ?? 1_000;
  const wait = options.wait ?? waitForMergeRead;
  const now = options.now ?? Date.now;
  if (
    !Number.isInteger(maxAttempts) ||
    maxAttempts < 1 ||
    maxAttempts > 12 ||
    !Number.isInteger(delayMs) ||
    delayMs < 0 ||
    delayMs > 1_000 ||
    typeof wait !== 'function' ||
    typeof now !== 'function'
  )
    throw new Error('merge verification polling bounds are invalid');
  if (!authorizationContext || typeof authorizationContext !== 'object')
    throw new Error('merge authorization context is required before any API call');
  const { packet, input } = authorizationContext;
  if (
    packet?.repositoryId !== repositoryId ||
    input?.repositoryId !== repositoryId ||
    packet?.pullRequest !== pullRequest ||
    input?.pullRequest !== pullRequest ||
    packet?.headSha !== headSha ||
    input?.headSha !== headSha ||
    packet?.baseSha !== expectedBaseSha ||
    input?.baseSha !== expectedBaseSha ||
    input?.baseRefName !== baseRefName ||
    authorizationContext.authorizationId !== authorizationId ||
    typeof authorizationContext.actor !== 'string' ||
    !authorizationContext.actor ||
    !['ADMIN', 'MAINTAIN', 'WRITE'].includes(authorizationContext.viewerPermission)
  )
    throw new Error('merge authorization context target binding is invalid; no PUT attempted');
  if (
    !['explicit-current-user', 'proto-ui-scheduled-merge-v1'].includes(authorizationId) &&
    !ownerAuthorizationAllows(authorizationContext.ownerAuthorization, {
      repositoryId,
      scopeId: 'pull-request:' + pullRequest,
      action: 'integrate',
      actor: authorizationContext.actor,
      authorizationId,
      executionMode: authorizationContext.executionMode,
      executionModeSource: authorizationContext.executionModeSource,
    })
  )
    throw new Error('merge owner authorization is invalid; no PUT attempted');
  validateReviewInputSnapshot(input);
  validateReviewPacket(packet, input);
  validatePublishedReviewPacket(packet, authorizationContext.publishedPacket);
  assertModelTraceFresh(authorizationContext.modelTrace, authorizationContext.modelTraceContext, {
    repositoryId,
  });
  // The writer owns this final collection. A caller-supplied allowed boolean
  // or callback cannot stand in for current checks, approvals or permissions.
  const finalLive = collectLiveReviewInput(repositoryId, pullRequest, {
    runner,
    externalEvidence: authorizationContext.externalEvidence,
  });
  if (
    finalLive.viewerLogin !== authorizationContext.actor ||
    finalLive.viewerPermission !== authorizationContext.viewerPermission
  )
    throw new Error(
      'merge credential identity or permission changed at the final boundary; no PUT attempted'
    );
  const finalAuthorization = authorizeLivePullRequestMerge(authorizationContext, finalLive);
  if (!finalAuthorization.allowed)
    throw new Error(
      `merge eligibility changed at the final boundary: ${finalAuthorization.reason}; no PUT attempted`
    );
  const prefix = `repos/${owner}/${name}`;
  const read = (endpoint, includeHeaders = false) => {
    let output;
    try {
      output = runner('gh', ['api', endpoint, ...(includeHeaders ? ['--include'] : [])], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        maxBuffer: MAX_LIVE_RESPONSE_BYTES,
      });
    } catch (error) {
      if (error instanceof SyntaxError || ['EACCES', 'EPERM', 'ENOBUFS'].includes(error?.code))
        throw error;
      // gh --include prints real response headers to stdout even on HTTP
      // failure. Body/stderr text alone cannot declare a rate-limit response.
      if (includeHeaders && error.stdout?.length) JSON.parse(parseMergeReadResponse(error.stdout));
      throw error;
    }
    const value = JSON.parse(includeHeaders ? parseMergeReadResponse(output) : output);
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('merge readback is malformed');
    return value;
  };
  const matchesTarget = (pull) =>
    pull.number === pullRequest &&
    pull.base?.repo?.full_name === `${owner}/${name}` &&
    pull.base?.ref === baseRefName &&
    pull.head?.sha === headSha;

  // GitHub's PUT supports a head SHA precondition, not a base SHA CAS. Re-read
  // both the PR and the actual base ref, then verify the resulting parent below.
  // A base change in the final read/write interval can still merge irreversibly;
  // that result must never produce a receipt bound to the old reviewed base.
  const before = read(`${prefix}/pulls/${pullRequest}`);
  if (
    !matchesTarget(before) ||
    before.state !== 'open' ||
    before.merged !== false ||
    before.draft !== false ||
    before.base.sha !== expectedBaseSha ||
    (before.body ?? '') !== input.pullRequestBody
  )
    throw new Error('merge preflight head, base, target or open state changed; no PUT attempted');
  const base = read(`${prefix}/git/ref/heads/${encodeURIComponent(baseRefName)}`);
  if (
    base.ref !== `refs/heads/${baseRefName}` ||
    base.object?.type !== 'commit' ||
    base.object?.sha !== expectedBaseSha
  )
    throw new Error('live base branch changed before merge; no PUT attempted');

  // Historical text remains readable, but cannot impersonate this merge's
  // ModelTrace or DCO trailers. Do not rewrite the original Git history.
  const quoteHistory = (text) =>
    text
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n');
  // GitHub appends commit_message to commit_title. Bind the subject to the
  // numeric target, never PR/commit title defaults that could add an unquoted
  // ModelTrace trailer after an irreversible PUT.
  const commitTitle = `Integrate pull request #${pullRequest}`;
  const commitMessage = [
    `Reviewed PR body:\n${quoteHistory(input.pullRequestBody)}`,
    ...input.commits.map(
      (commit) => `Reviewed commit ${commit.sha}:\n${quoteHistory(commit.message)}`
    ),
    renderModelTraceDisclosure(authorizationContext.modelTrace, 'commit'),
  ].join('\n\n');
  assertModelTraceDisclosure(
    `${commitTitle}\n\n${commitMessage}`,
    authorizationContext.modelTrace,
    'commit'
  );
  // Revalidate after the last live read and sealed message construction. Owner
  // revocation and measurement expiry remain independent of the exact head,
  // trusted checks, publication and narrow preview-authorization exception.
  const restAuthorization = authorizeLivePullRequestMerge(authorizationContext, {
    ...finalLive,
    mergeable: before.mergeable === true ? 'MERGEABLE' : 'UNKNOWN',
    mergeStateStatus:
      typeof before.mergeable_state === 'string' ? before.mergeable_state.toUpperCase() : 'UNKNOWN',
  });
  if (!restAuthorization.allowed)
    throw new Error(
      `final GitHub merge readiness is not eligible: ${restAuthorization.reason}; no PUT attempted`
    );
  let response;
  try {
    response = JSON.parse(
      runner(
        'gh',
        ['api', '--method', 'PUT', `${prefix}/pulls/${pullRequest}/merge`, '--input', '-'],
        {
          encoding: 'utf8',
          input: JSON.stringify({
            sha: headSha,
            merge_method: mergeMethod,
            commit_title: commitTitle,
            commit_message: commitMessage,
          }),
          stdio: ['pipe', 'pipe', 'pipe'],
          maxBuffer: MAX_LIVE_RESPONSE_BYTES,
        }
      )
    );
  } catch (error) {
    // A lost/unknown PUT has no attributable successful response. Keep exactly
    // one read-only reconciliation; the successful-PUT poll never applies here.
    try {
      const live = read(`${prefix}/pulls/${pullRequest}`);
      if (
        live.merged === true &&
        live.head?.sha === headSha &&
        /^[a-f0-9]{40,64}$/.test(live.merge_commit_sha ?? '')
      )
        throw new Error(
          `merge outcome is ambiguous after live reconciliation: ${live.merge_commit_sha} merged the inspected head, but this invocation and ${mergeMethod} method cannot be attributed; do not retry blindly`
        );
    } catch (reconciliationError) {
      if (
        reconciliationError instanceof Error &&
        reconciliationError.message.startsWith('merge outcome is ambiguous')
      )
        throw reconciliationError;
    }
    throw new Error(`merge outcome was not confirmed; do not retry blindly (${error.message})`);
  }
  if (response?.merged === false)
    throw new Error(`merge was rejected: ${response.message ?? 'receipt is incomplete'}`);
  if (response?.merged !== true || !/^[a-f0-9]{40,64}$/.test(response.sha ?? ''))
    throw new Error(
      'merge response did not provide a confirmed commit identity; do not retry blindly'
    );

  let lastObservation = 'merged state is not yet visible';
  let rateLimitAttempts = 0;
  let rateLimitWaitMs = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let nextDelayMs = delayMs;
    try {
      const live = read(`${prefix}/pulls/${pullRequest}`, true);
      if (!matchesTarget(live)) throw new Error('post-merge target or head does not match');
      if (live.merged === true && live.state === 'closed') {
        if (live.merge_commit_sha !== response.sha || !isGitHubMergeTime(live.merged_at))
          throw new Error('live merge commit or merge time does not match the successful response');
        const commit = read(`${prefix}/git/commits/${response.sha}`, true);
        if (
          commit.sha !== response.sha ||
          !Array.isArray(commit.parents) ||
          commit.parents.length !== 1 ||
          commit.parents[0]?.sha !== expectedBaseSha
        )
          throw new Error('resulting merge parent differs from the inspected base');
        assertModelTraceDisclosure(commit.message, authorizationContext.modelTrace, 'commit');
        return {
          merged: true,
          reconciled: false,
          repositoryId,
          pullRequest,
          authorizationId,
          permissionsObservedAt: finalLive.permissionsObservedAt,
          mergeCommitSha: response.sha,
          headSha,
          liveHeadSha: live.head.sha,
          baseRefName,
          baseSha: expectedBaseSha,
          mergeParentSha: commit.parents[0].sha,
          mergeMethod,
          mergedAt: live.merged_at,
          message: response.message ?? null,
        };
      }
      if (live.merged !== false || live.state !== 'open')
        throw new Error('post-merge state is inconsistent');
      lastObservation = 'merged state is not yet visible';
    } catch (error) {
      if (
        error instanceof MergeHttpReadError &&
        (error.status === 429 ||
          (error.status === 403 &&
            (Object.hasOwn(error.headers, 'retry-after') ||
              error.headers['x-ratelimit-remaining'] === '0')))
      ) {
        try {
          nextDelayMs = Math.max(delayMs, mergeRateLimitDelay(error, ++rateLimitAttempts, now));
          if (!Number.isSafeInteger(nextDelayMs) || nextDelayMs + rateLimitWaitMs > 120_000)
            throw new Error('rate-limit wait exceeds the 120000ms cumulative verification budget');
          rateLimitWaitMs += nextDelayMs;
        } catch (timingError) {
          throw new Error(
            `merge PUT succeeded as ${response.sha}, but ${timingError.message}; do not repeat the PUT`
          );
        }
      } else if (!isTransientMergeRead(error)) {
        throw new Error(
          `merge PUT succeeded as ${response.sha}, but its receipt cannot bind the reviewed head/base (${error.message}); do not repeat the PUT`
        );
      }
      lastObservation = error.message;
    }
    if (attempt < maxAttempts) wait(nextDelayMs);
  }
  throw new Error(
    `merge PUT succeeded as ${response.sha}, but receipt verification exhausted ${maxAttempts} read-only attempts (${lastObservation}); do not repeat the PUT`
  );
}
export function collectCurrentReviewerPermissions(input, options = {}) {
  validateReviewInputSnapshot(input);
  const { owner, name } = parseRepositoryId(input.repositoryId);
  const runner = options.runner ?? execFileSync;
  const logins = reviewerPermissionSubjects(input);
  return logins.map((login) => {
    const endpoint = `repos/${owner}/${name}/collaborators/${encodeURIComponent(login)}/permission`;
    const result = ghJson(['api', endpoint], runner);
    if (
      typeof result?.user?.login !== 'string' ||
      result.user.login.toLowerCase() !== login ||
      !['admin', 'write', 'read', 'none'].includes(result.permission)
    ) {
      throw new Error(`current reviewer permission identity or value is unavailable for ${login}`);
    }
    // GitHub's legacy base permission maps maintain -> write and triage -> read.
    // role_name is display metadata; it cannot upgrade the observed base permission.
    return {
      login: result.user.login.toLowerCase(),
      permission: result.permission,
      source: 'github-rest-collaborator-permission',
      endpoint,
      repositoryId: input.repositoryId,
      headSha: input.headSha,
    };
  });
}

// These bounds cover both complete stability scans, including permissions and
// REST files. A bound/failure aborts the entire invocation without partial input.
export const MAX_LIVE_COLLECTION_REQUESTS = 1000;
export const MAX_LIVE_COLLECTION_BYTES = 256 * 1024 * 1024;

export function collectLiveReviewInput(repositoryId, pullRequest, options = {}) {
  const { owner, name } = parseRepositoryId(repositoryId);
  if (!Number.isSafeInteger(pullRequest) || pullRequest < 1)
    throw new Error('live collection pull request is invalid');
  const externalEvidence = Array.isArray(options.externalEvidence) ? options.externalEvidence : [];
  const runner = options.runner ?? execFileSync;
  let requests = 0;
  let bytes = 0;
  const boundedRunner = (...args) => {
    if (++requests > MAX_LIVE_COLLECTION_REQUESTS)
      throw new Error(`live collection exceeds the ${MAX_LIVE_COLLECTION_REQUESTS}-request bound`);
    const response = runner(...args);
    bytes += Buffer.byteLength(response, 'utf8');
    if (bytes > MAX_LIVE_COLLECTION_BYTES)
      throw new Error(
        `live collection exceeds the ${MAX_LIVE_COLLECTION_BYTES}-byte cumulative payload bound`
      );
    return response;
  };
  function collect() {
    const snapshot = collectReviewSnapshot({
      owner,
      name,
      pullRequest,
      read: (args) => ghJson(args, boundedRunner),
    });
    const live = buildLiveReviewInput(
      snapshot.raw,
      repositoryId,
      pullRequest,
      externalEvidence,
      snapshot.files
    );
    live.input.reviewerPermissions = collectCurrentReviewerPermissions(live.input, {
      runner: boundedRunner,
    });
    validateReviewInputSnapshot(live.input);
    snapshot.verifyState();
    return { live, anchor: snapshot.anchor };
  }
  // Two complete observations detect same-count edits/deletions, nested replies,
  // changed check provenance and permission drift, not only head/count changes.
  // This is bounded stability checking, not a server-side atomic snapshot.
  const before = collect();
  const after = collect();
  if (
    !isDeepStrictEqual(before.anchor, after.anchor) ||
    computeReviewInputDigest(before.live.input) !== computeReviewInputDigest(after.live.input)
  )
    throw new Error('live review-input material state changed between complete collection scans');
  after.live.permissionsObservedAt = (options.now ?? (() => new Date()))().toISOString();
  return after.live;
}
