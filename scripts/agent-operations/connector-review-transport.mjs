// First-class trusted connector calls; no CLI credentials or network fallback.
import { validateReviewInputSnapshot, reviewerPermissionSubjects } from './review-runtime.mjs';
import { LEDGER_REPOSITORY, LEDGER_PRINCIPAL } from './cloud-review-ledger.mjs';

export const CONNECTOR_REPOSITORY = 'Proto-UI/Proto-UI';
const base = `https://api.github.com/repos/${CONNECTOR_REPOSITORY}`;
const assert = (value, message) => {
  if (!value) throw new Error(message);
};
const numeric = (value) => /^[1-9][0-9]*$/.test(String(value));
const upper = (value) => (typeof value === 'string' ? value.toUpperCase() : null);
const login = (user) =>
  user?.type === 'Bot' ? user.login.replace(/\[bot\]$/, '') : (user?.login ?? 'ghost');
const commitActor = (commit, role) => ({
  login: commit[role]?.login ?? null,
  name: commit.commit?.[role]?.name ?? '',
  email: commit.commit?.[role]?.email ?? '',
  // REST signature validity alone does not attest GitHub platform authorship.
  platform: null,
});
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// call(operation, arguments) must be the parent's trusted tool dispatcher, NOT
// a callback supplied by PR content. Preserve the actual tool result envelope.
export class ConnectorReviewTransport {
  #call;
  constructor(call) {
    assert(typeof call === 'function', 'trusted connector dispatcher required');
    this.#call = call;
  }
  async call(operation, args) {
    const result = await this.#call(operation, structuredClone(args));
    assert(
      result && !result.isError && result.structuredContent,
      `connector ${operation} failed or returned no structured result`
    );
    return result.structuredContent;
  }
  async get(path) {
    assert(
      path.startsWith('/') && !path.includes('..') && !path.includes('#'),
      'invalid repository read path'
    );
    const result = await this.call('fetch', { url: base + path });
    assert(typeof result.content === 'string', 'raw connector GET content missing');
    return JSON.parse(result.content);
  }
  async pages(path, field = null, identity = (item) => item.id ?? item.sha ?? item.filename) {
    const items = [];
    const ids = new Set();
    let total;
    // Terminal empty page is observed, not a forged GraphQL pageInfo. Bound
    // resources and reject repeated pages/IDs or changing declared counts.
    for (let page = 1; page <= 30; page++) {
      const response = await this.get(
        `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`
      );
      const batch = field ? response[field] : response;
      assert(Array.isArray(batch), 'paginated response is not an array');
      if (field && Number.isInteger(response.total_count)) {
        if (total !== undefined) assert(total === response.total_count, 'pagination total changed');
        total = response.total_count;
      }
      if (!batch.length) {
        if (total !== undefined) assert(items.length === total, 'pagination inventory incomplete');
        return items;
      }
      assert(batch.length <= 100, 'unexpected pagination size');
      for (const item of batch) {
        const id = identity(item);
        assert(id !== undefined && !ids.has(String(id)), 'duplicate/repeated pagination item');
        ids.add(String(id));
        items.push(item);
      }
    }
    throw new Error('pagination budget exceeded; collection incomplete');
  }
  async observeHead(pullRequest) {
    const current = await this.get(`/pulls/${pullRequest}`);
    assert(
      current.number === pullRequest &&
        current.base?.repo?.full_name === CONNECTOR_REPOSITORY &&
        /^[a-f0-9]{40}$/.test(current.head?.sha),
      'post-publication head observation is incomplete'
    );
    return current.head.sha;
  }
  async collectInitialSweep() {
    const profile = await this.call('get_user_login', {});
    assert(
      String(profile.id) === LEDGER_PRINCIPAL.id && profile.login === LEDGER_PRINCIPAL.login,
      'connected principal is not the delegated owner'
    );
    const permission = await this.call('get_repo_collaborator_permission', {
      repository_full_name: CONNECTOR_REPOSITORY,
      username: profile.login,
    });
    assert(
      ['admin', 'maintain', 'write'].includes(permission.permission),
      'live permission unavailable'
    );
    const read = async () => {
      const rows = await this.pages('/pulls?state=open&sort=created&direction=asc');
      assert(rows.length <= 1000, 'initial sweep inventory budget exceeded');
      const numbers = [];
      for (const row of rows) {
        assert(
          row.state === 'open' &&
            Number.isSafeInteger(row.number) &&
            row.number > 0 &&
            numeric(row.user?.id) &&
            typeof row.user?.login === 'string',
          'initial sweep inventory identity incomplete'
        );
        if (
          String(row.user.id) !== LEDGER_PRINCIPAL.id &&
          row.user.login.toLowerCase() !== LEDGER_PRINCIPAL.login
        )
          numbers.push(row.number);
      }
      numbers.sort((a, b) => a - b);
      assert(new Set(numbers).size === numbers.length, 'duplicate initial sweep PR');
      return numbers;
    };
    const first = await read();
    assert(same(first, await read()), 'initial sweep inventory changed during capture');
    return first;
  }
  async collect(pullRequest, externalEvidence = []) {
    assert(Number.isSafeInteger(pullRequest) && pullRequest > 0, 'invalid pull request');
    const profile = await this.call('get_user_login', {});
    assert(
      String(profile.id) === LEDGER_PRINCIPAL.id && profile.login === LEDGER_PRINCIPAL.login,
      'connected principal is not the delegated owner'
    );
    const permissionArgs = {
      repository_full_name: CONNECTOR_REPOSITORY,
      username: profile.login,
    };
    const permission = await this.call('get_repo_collaborator_permission', permissionArgs);
    // The authenticated invocation binds the subject. Redundant echoed user or
    // repository fields are neither required nor invented in the result.
    assert(
      ['admin', 'write', 'maintain'].includes(permission.permission),
      'live review permission unavailable'
    );
    const pr = await this.get(`/pulls/${pullRequest}`);
    assert(
      pr.number === pullRequest && pr.base?.repo?.full_name === CONNECTOR_REPOSITORY,
      'PR target mismatch'
    );
    assert(
      numeric(pr.user?.id) && typeof pr.user.login === 'string',
      'PR author identity unavailable'
    );
    assert(
      String(pr.user.id) !== LEDGER_PRINCIPAL.id &&
        pr.user.login.toLowerCase() !== LEDGER_PRINCIPAL.login,
      'owner-authored PR excluded'
    );
    const [files, commits, reviews, comments, inline, threadResult, runs, checkRuns, statuses] =
      await Promise.all([
        // Blob SHAs identify content; distinct file paths can share a blob.
        this.pages(`/pulls/${pullRequest}/files`, null, (file) => file.filename),
        this.pages(`/pulls/${pullRequest}/commits`),
        this.pages(`/pulls/${pullRequest}/reviews`),
        this.pages(`/issues/${pullRequest}/comments`),
        this.pages(`/pulls/${pullRequest}/comments`),
        this.call('list_pull_request_review_threads', {
          repo_full_name: CONNECTOR_REPOSITORY,
          pr_number: pullRequest,
        }),
        this.pages(`/actions/runs?head_sha=${pr.head.sha}`, 'workflow_runs'),
        this.pages(`/commits/${pr.head.sha}/check-runs?filter=latest`, 'check_runs'),
        this.pages(`/commits/${pr.head.sha}/statuses`),
      ]);
    assert(
      files.length === pr.changed_files &&
        commits.length === pr.commits &&
        commits.at(-1)?.sha === pr.head.sha,
      'file/commit inventory does not bind the live PR'
    );
    const threads = threadResult.review_threads;
    assert(Array.isArray(threads), 'thread inventory missing');
    const seenComments = new Set();
    const seenThreads = new Set();
    const replies = [];
    const canonicalThreads = threads.map((thread) => {
      assert(
        typeof thread.id === 'string' &&
          !seenThreads.has(thread.id) &&
          typeof thread.is_resolved === 'boolean',
        'invalid/duplicate thread'
      );
      seenThreads.add(thread.id);
      assert(
        Array.isArray(thread.comments) && thread.comments.length > 0,
        'empty/incomplete thread cannot be canonicalized'
      );
      for (const comment of thread.comments) {
        const raw = inline.find((item) => String(item.id) === String(comment.database_id));
        assert(
          raw &&
            !seenComments.has(String(raw.id)) &&
            raw.node_id === comment.id &&
            raw.body === comment.body &&
            raw.updated_at === comment.updated_at &&
            login(raw.user) === (comment.author?.login ?? 'ghost'),
          'thread/REST comment coverage or revision mismatch'
        );
        seenComments.add(String(raw.id));
        replies.push({
          id: String(raw.id),
          threadId: thread.id,
          author: login(raw.user),
          body: raw.body,
          updatedAt: raw.updated_at,
        });
      }
      return {
        id: thread.id,
        isResolved: thread.is_resolved,
        updatedAt: thread.comments
          .map((c) => c.updated_at)
          .sort()
          .at(-1),
      };
    });
    assert(seenComments.size === inline.length, 'thread tool omitted known REST review comments');
    // This is explicit submitted-comment coverage, not a claim that the
    // connector exposes cursors or has proven unbounded auto-pagination.
    // The trusted repository-scoped check-runs request binds repository identity.
    // Each returned head and provider is retained; canonical policy decides trust.
    const checks = checkRuns.map((check) => {
      assert(check.head_sha === pr.head.sha, 'check run belongs to another head');
      const matching = runs.filter(
        (run) =>
          run.head_sha === pr.head.sha &&
          run.check_suite_id === check.check_suite?.id &&
          run.repository?.full_name === CONNECTOR_REPOSITORY
      );
      assert(matching.length <= 1, 'ambiguous workflow provenance');
      const run = matching[0];
      return {
        name: check.name,
        status: upper(check.status),
        conclusion: upper(check.conclusion),
        completedAt: check.completed_at ?? null,
        detailsUrl: check.details_url ?? check.html_url ?? null,
        source: check.app?.slug ?? 'unknown-check-run',
        providerId: check.app?.node_id ?? null,
        repository: CONNECTOR_REPOSITORY,
        workflowName: run?.name ?? null,
        workflowPath: run?.path ?? null,
      };
    });
    const latestStatuses = new Map();
    // GitHub returns commit statuses in reverse chronological order.
    for (const status of statuses)
      if (!latestStatuses.has(status.context)) latestStatuses.set(status.context, status);
    for (const status of latestStatuses.values()) {
      const terminal = ['success', 'failure', 'error'].includes(status.state);
      checks.push({
        name: status.context,
        providerId: null,
        status: terminal ? 'COMPLETED' : upper(status.state),
        conclusion: terminal ? upper(status.state) : null,
        completedAt: status.created_at,
        detailsUrl: status.target_url,
        source:
          status.creator?.login === 'vercel[bot]' && status.creator?.type === 'Bot'
            ? 'vercel'
            : 'status-context',
        repository: null,
        workflowName: null,
        workflowPath: null,
      });
    }
    const input = {
      schemaVersion: 5,
      kind: 'proto-ui.review-input',
      repositoryId: LEDGER_REPOSITORY,
      pullRequest,
      pullRequestState: pr.merged ? 'MERGED' : upper(pr.state),
      pullRequestAuthor: pr.user.login,
      isDraft: pr.draft,
      baseRefName: pr.base.ref,
      baseSha: pr.base.sha,
      headSha: pr.head.sha,
      pullRequestBody: pr.body ?? '',
      changedFiles: files.map((f) => ({
        path: f.filename,
        previousPath: f.previous_filename ?? null,
        status: f.status,
      })),
      commits: commits.map((c) => ({
        sha: c.sha,
        message: c.commit.message,
        author: commitActor(c, 'author'),
        committer: commitActor(c, 'committer'),
      })),
      reviews: reviews.map((r) => ({
        id: r.node_id,
        author: r.user ? login(r.user) : null,
        state: r.state,
        commitSha: r.commit_id ?? null,
        submittedAt: r.submitted_at ?? null,
        body: r.body ?? '',
      })),
      reviewerPermissions: [],
      comments: comments.map((c) => ({
        id: c.node_id,
        author: login(c.user),
        body: c.body ?? '',
        updatedAt: c.updated_at,
      })),
      replies,
      threads: canonicalThreads,
      checks,
      externalEvidence,
    };
    validateReviewInputSnapshot(input);
    for (const reviewer of reviewerPermissionSubjects(input)) {
      const observed = await this.call('get_repo_collaborator_permission', {
        repository_full_name: CONNECTOR_REPOSITORY,
        username: reviewer,
      });
      // The connector may expose GitHub roles instead of legacy base permissions.
      // Keep canonical approval eligibility unchanged; role_name cannot upgrade it.
      const permission =
        observed.permission === 'maintain'
          ? 'write'
          : observed.permission === 'triage'
            ? 'read'
            : observed.permission;
      assert(
        ['admin', 'write', 'read', 'none'].includes(permission),
        'approval reviewer permission unavailable'
      );
      input.reviewerPermissions.push({
        login: reviewer,
        permission,
        source: 'github-rest-collaborator-permission',
        endpoint: `repos/${CONNECTOR_REPOSITORY}/collaborators/${encodeURIComponent(reviewer)}/permission`,
        repositoryId: LEDGER_REPOSITORY,
        headSha: input.headSha,
      });
    }
    validateReviewInputSnapshot(input);
    const after = await this.get(`/pulls/${pullRequest}`);
    const revision = (x) => [
      x.number,
      x.base?.repo?.full_name,
      x.head?.sha,
      x.base?.sha,
      x.base?.ref,
      x.state,
      x.draft,
      x.body,
      x.user?.id,
      x.user?.login,
      x.commits,
      x.changed_files,
      x.updated_at,
    ];
    assert(same(revision(pr), revision(after)), 'PR changed during collection');
    const contributors = commits.map((c) => ({
      sha: c.sha,
      author: c.author ? { id: String(c.author.id), login: c.author.login } : null,
      committer: c.committer ? { id: String(c.committer.id), login: c.committer.login } : null,
    }));
    const contributionGap = contributors.some((c) =>
      [c.author, c.committer].some((a) => !a || !numeric(a.id) || typeof a.login !== 'string')
    );
    const contributed = contributors.some((c) =>
      [c.author, c.committer].some(
        (a) =>
          a && (a.id === LEDGER_PRINCIPAL.id || a.login?.toLowerCase() === LEDGER_PRINCIPAL.login)
      )
    );
    return {
      input,
      reviewIdentities: reviews.map((review) => ({
        nodeId: review.node_id,
        id: numeric(review.id) ? String(review.id) : null,
        authorId: numeric(review.user?.id) ? String(review.user.id) : null,
      })),
      viewerLogin: profile.login,
      reviewerId: String(profile.id),
      authorLogin: pr.user.login,
      authorId: String(pr.user.id),
      permission: permission.permission,
      contributors,
      contributionGap,
      contributed,
      coverage: {
        method: 'terminal-rest-pages-and-thread-comment-bijection',
        reviewComments: inline.length,
        threads: threads.length,
        connectorPaginationContract: 'not-exposed',
        scope: 'submitted-visible-review-comments',
      },
      permissionEvidence: {
        operation: 'get_repo_collaborator_permission',
        arguments: permissionArgs,
        result: { permission: permission.permission },
      },
    };
  }
  async submit(pullRequest, intent) {
    assert(
      intent.repositoryId === LEDGER_REPOSITORY &&
        intent.pullRequest === pullRequest &&
        /^[a-f0-9]{40}$/.test(intent.headSha),
      'publication target/head mismatch'
    );
    assert(
      ['APPROVE', 'REQUEST_CHANGES'].includes(intent.recommendation) &&
        typeof intent.body === 'string',
      'invalid disposition/body'
    );
    const args = {
      repo_full_name: CONNECTOR_REPOSITORY,
      pr_number: pullRequest,
      commit_id: intent.headSha,
      action: intent.recommendation,
      review: intent.body,
    };
    const result = await this.call('add_review_to_pr', args); // exactly one call; no automatic retry
    const returned = result.review ?? result;
    assert(
      typeof returned.id === 'string' || Number.isSafeInteger(returned.id),
      'successful review response has no attributable object id; outcome unknown'
    );
    // Normalized GraphQL node IDs and REST numeric IDs are joined by live raw
    // objects, not guessed. Missing echoed head/body may come from readback;
    // any echoed contradictory field is a rejection.
    const all = await this.pages(`/pulls/${pullRequest}/reviews`);
    const matches = all.filter(
      (r) => String(r.id) === String(returned.id) || r.node_id === returned.id
    );
    assert(
      matches.length === 1,
      'returned review id cannot be uniquely read back; outcome unknown'
    );
    const live = matches[0];
    for (const field of ['node_id', 'nodeId'])
      if (Object.hasOwn(returned, field))
        assert(returned[field] === live.node_id, 'review response node-id contradiction');
    const echoedAuthor = returned.author ?? returned.user;
    if (echoedAuthor?.login !== undefined)
      assert(echoedAuthor.login === LEDGER_PRINCIPAL.login, 'review response actor contradiction');
    if (echoedAuthor?.id != null)
      assert(
        String(echoedAuthor.id) === LEDGER_PRINCIPAL.id,
        'review response actor-id contradiction'
      );
    const expectedState = intent.recommendation === 'APPROVE' ? 'APPROVED' : 'CHANGES_REQUESTED';
    assert(
      live.commit_id === args.commit_id &&
        live.body === args.review &&
        live.state === expectedState &&
        String(live.user?.id) === LEDGER_PRINCIPAL.id &&
        live.user.login === LEDGER_PRINCIPAL.login,
      'review readback disagrees with submitted target, actor, head, body or disposition; outcome unknown'
    );
    for (const [field, expected] of [
      ['body', live.body],
      ['state', live.state],
      ['commit_id', live.commit_id],
    ]) {
      if (returned[field] !== undefined)
        assert(returned[field] === expected, 'review response/readback contradiction');
    }
    return {
      repositoryId: LEDGER_REPOSITORY,
      pullRequest,
      id: String(live.id),
      nodeId: live.node_id,
      authorId: String(live.user.id),
      authorLogin: live.user.login,
      commitId: live.commit_id,
      state: live.state,
      body: live.body,
    };
  }
}
