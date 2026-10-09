// Inactive integration: authenticated reads when supported, never a review POST.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  collectLiveReviewInput,
  summarizeLiveChecks,
  summarizeLiveDco,
} from './collect-live-review-input.mjs';
import {
  authorizeReviewSubmission,
  computeReviewInputDigest,
  verifyLiveReviewInput,
} from './review-runtime.mjs';
import { simulateCloudReviewExchange } from './cloud-review-simulation.mjs';
import {
  LEDGER_PRINCIPAL,
  LEDGER_REPOSITORY,
  inspectCloudReviewReceipt,
} from './cloud-review-ledger.mjs';

const repository = 'Proto-UI/Proto-UI';
const source = 'delegated-owner-event';
const candidateId = 'inactive-cloud-review-simulation';
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function json(runner, args) {
  return JSON.parse(
    runner('gh', ['api', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  );
}
function complete(connection, label) {
  assert(
    Array.isArray(connection?.nodes) && connection.pageInfo?.hasNextPage === false,
    `cloud collection requires complete ${label}; missing pagination proof is not empty data`
  );
}

// Additional numeric actor observations supplement canonical v5 identity facts.
// Both canonical input and these observations are re-read at the final boundary.
export function collectCloudReviewInput(
  pullRequest,
  { runner = execFileSync, externalEvidence = [] } = {}
) {
  assert(Number.isSafeInteger(pullRequest) && pullRequest > 0, 'invalid pull request');
  const checkedRunner = (command, args, options) => {
    const raw = runner(command, args, options);
    if (args[1] === 'graphql') {
      const result = JSON.parse(raw);
      const pr = result.data?.repository?.pullRequest;
      assert(pr, 'canonical GraphQL collection unavailable');
      for (const key of ['commits', 'reviews', 'comments', 'reviewThreads']) complete(pr[key], key);
      for (const thread of pr.reviewThreads.nodes) complete(thread.comments, 'thread comments');
      complete(pr.commits.nodes.at(-1)?.commit?.statusCheckRollup?.contexts, 'head checks');
    }
    return raw;
  };
  const live = collectLiveReviewInput(LEDGER_REPOSITORY, pullRequest, {
    externalEvidence,
    runner: checkedRunner,
  });
  const viewer = json(runner, ['user']);
  const pr = json(runner, [`repos/${repository}/pulls/${pullRequest}`]);
  const pages = json(runner, [
    '--paginate',
    '--slurp',
    `repos/${repository}/pulls/${pullRequest}/commits?per_page=100`,
  ]);
  assert(Array.isArray(pages) && pages.every(Array.isArray), 'commit identity pages are malformed');
  const commits = pages.flat();
  assert(
    pr.number === pullRequest &&
      pr.base?.repo?.full_name === repository &&
      pr.head?.sha === live.input.headSha &&
      pr.base?.sha === live.input.baseSha,
    'live REST/GraphQL target or exact head/base disagreement'
  );
  assert(
    String(viewer.id) === LEDGER_PRINCIPAL.id &&
      viewer.login === LEDGER_PRINCIPAL.login &&
      live.viewerLogin === viewer.login,
    'live delegated principal mismatch'
  );
  assert(
    pr.user?.login === live.authorLogin && /^[1-9][0-9]*$/.test(String(pr.user?.id)),
    'live author identity mismatch'
  );
  assert(
    String(pr.user.id) !== LEDGER_PRINCIPAL.id &&
      pr.user.login.toLowerCase() !== LEDGER_PRINCIPAL.login,
    'owner-authored PR is excluded'
  );
  assert(
    commits.length === live.input.commits.length &&
      commits.every((commit, index) => commit.sha === live.input.commits[index].sha),
    'commit identity inventory is incomplete'
  );
  const identities = commits.map((commit) => {
    for (const actor of [commit.author, commit.committer]) {
      assert(
        typeof actor?.login === 'string' && /^[1-9][0-9]*$/.test(String(actor.id)),
        'commit contributor identity is unavailable; no inferred bot exemption'
      );
      assert(
        String(actor.id) !== LEDGER_PRINCIPAL.id &&
          actor.login.toLowerCase() !== LEDGER_PRINCIPAL.login,
        'reviewer contributed to this PR'
      );
    }
    return {
      sha: commit.sha,
      author: { id: String(commit.author.id), login: commit.author.login },
      committer: { id: String(commit.committer.id), login: commit.committer.login },
    };
  });
  const permission = json(runner, [`repos/${repository}/collaborators/${viewer.login}/permission`]);
  assert(
    permission.user?.login === viewer.login &&
      String(permission.user.id) === String(viewer.id) &&
      ['admin', 'write'].includes(permission.permission) &&
      ['ADMIN', 'MAINTAIN', 'WRITE'].includes(live.viewerPermission),
    'live reviewer write permission is unavailable'
  );
  return {
    ...live,
    identities,
    reviewerId: String(viewer.id),
    authorId: String(pr.user.id),
    permission: permission.permission,
  };
}

// The parent supplies its packet after inspecting begin(). This helper never
// creates findings, chooses a disposition, or assumes its model is the reviewer.
export class CloudReviewDryRun {
  #ledger;
  #policy;
  #options;
  #captured;
  #used = false;
  constructor(ledger, policy, options = {}) {
    this.#ledger = ledger;
    this.#policy = structuredClone(policy);
    this.#options = options;
  }
  begin(pullRequest) {
    assert(!this.#captured && !this.#used, 'one parent-review lifecycle per instance');
    const live = collectCloudReviewInput(pullRequest, this.#options);
    const before = this.#ledger.read();
    const claimed = this.#ledger.apply(before.revision, { type: 'claim', pullRequest });
    assert(claimed.status === 'applied', 'claim not confirmed; do not retry');
    this.#captured = structuredClone(live);
    return {
      input: structuredClone(live.input),
      priorAnalysis:
        before.state.analyses.find((item) => item.input.pullRequest === pullRequest) ?? null,
      publicationAllowed: false,
      executionMode: 'autonomous',
      executionModeSource: source,
    };
  }
  prepare(packet, selfAssessment) {
    return this.#prepare(packet, selfAssessment, 'stageIntent');
  }
  simulate(packet, selfAssessment, exchange) {
    const prepared = this.#prepare(packet, selfAssessment, 'stageSimulationIntent');
    return simulateCloudReviewExchange(this.#ledger, prepared, exchange, () => {
      const final = collectCloudReviewInput(this.#captured.input.pullRequest, this.#options);
      verifyLiveReviewInput(prepared.intent.analysis.packet, final.input);
      assert(
        hash(final.identities) === hash(this.#captured.identities) &&
          final.authorId === this.#captured.authorId &&
          final.permission === this.#captured.permission,
        'identity or permission changed after intent persistence'
      );
    });
  }
  #prepare(packet, selfAssessment, intentCommand) {
    assert(this.#captured && !this.#used, 'begin first; preparation is single-use');
    this.#used = true;
    const initial = this.#captured;
    const live = collectCloudReviewInput(initial.input.pullRequest, this.#options);
    assert(
      hash(live.identities) === hash(initial.identities) &&
        live.authorId === initial.authorId &&
        live.permission === initial.permission,
      'identity or permission changed during parent review'
    );
    assert(
      packet.agentEvidence?.disposition === 'complete' &&
        packet.agentEvidence.debt.length === 0 &&
        packet.humanGates?.length === 0,
      'cloud candidate requires complete evidence and no human judgment gate'
    );
    assert(
      ['APPROVE', 'REQUEST_CHANGES'].includes(packet.recommendedAction),
      'candidate requires a disposition'
    );
    const parameters = {
      modelTrace: this.#options.modelTrace,
      modelTraceContext: this.#options.modelTraceContext,
      packet,
      input: initial.input,
      liveInput: live.input,
      executionMode: 'autonomous',
      executionModeSource: source,
      authorizationId: candidateId,
      selfAssessment,
      credentialCanReview: true,
      reviewer: live.viewerLogin,
      pullRequestAuthor: live.authorLogin,
      priorPacket:
        this.#ledger
          .read()
          .state.analyses.find((x) => x.input.pullRequest === initial.input.pullRequest)?.packet ??
        null,
      dcoConclusion: summarizeLiveDco(live.input.checks, {
        repositoryId: LEDGER_REPOSITORY,
        trustedRepositoryId: this.#policy.trustedDcoEvidence?.repositoryId,
        trustedCheckName: this.#policy.trustedDcoEvidence?.checkName,
        trustedSource: this.#policy.trustedDcoEvidence?.source,
        trustedProviderId: this.#policy.trustedDcoEvidence?.providerId,
        trustedDetailsUrl: this.#policy.trustedDcoEvidence?.detailsUrl,
      }),
      ciConclusion: summarizeLiveChecks(live.input.checks, {
        repositoryId: LEDGER_REPOSITORY,
        trustedRepositoryId: this.#policy.trustedCiEvidence?.repositoryId,
        trustedSource: this.#policy.trustedCiEvidence?.source,
        trustedCheckNames: this.#policy.trustedCiEvidence?.checkNames,
        trustedWorkflowNames: this.#policy.trustedCiEvidence?.workflowNames,
        trustedWorkflowPaths: this.#policy.trustedCiEvidence?.workflowPaths,
      }),
    };
    const actual = authorizeReviewSubmission({ ...parameters, policy: this.#policy });
    assert(!actual.allowed, 'unexpected active candidate scope; this adapter cannot publish');
    // Exercise the EXISTING canonical gates without altering active policy or
    // disguising event provenance. This private hypothetical policy is never
    // returned as authority and has no writer connected to it.
    const simulatedPolicy = structuredClone(this.#policy);
    simulatedPolicy.reviewSubmissionAuthorizations = [
      {
        id: candidateId,
        status: 'active',
        executionMode: 'autonomous',
        executionModeSource: source,
        repositoryId: LEDGER_REPOSITORY,
        mutationClass: 'conditional-review-submission',
        allowedRecommendations: ['APPROVE', 'REQUEST_CHANGES'],
      },
    ];
    const simulated = authorizeReviewSubmission({ ...parameters, policy: simulatedPolicy });
    assert(simulated.allowed, `canonical dry-run gate rejected: ${simulated.reason}`);
    const before = this.#ledger.read();
    const result = this.#ledger.apply(before.revision, {
      type: intentCommand,
      input: initial.input,
      packet,
      liveInput: live.input,
      observation: {
        executionMode: 'autonomous',
        executionModeSource: source,
        reviewerId: live.reviewerId,
        reviewerLogin: live.viewerLogin,
        authorId: live.authorId,
        authorLogin: live.authorLogin,
        policyDigest: hash(this.#policy),
      },
    });
    assert(result.status === 'applied', 'intent not confirmed; do not retry or publish');
    const intent = this.#ledger.read().state.slot.intent;
    return {
      publicationAllowed: false,
      mode: 'dry-run',
      canonicalAuthorization: actual,
      simulatedGatesPassed: true,
      inputDigest: computeReviewInputDigest(live.input),
      intent,
      request: { commit_id: packet.headSha, event: packet.recommendedAction, body: intent.body },
    };
  }
}

// Authenticated GET can confirm an object's current contents, not the origin of
// a caller-supplied POST response. Never finalizes/releases the durable slot.
export function inspectCloudReceiptReadback(intent, postResponse, { runner = execFileSync } = {}) {
  assert(
    /^[1-9][0-9]*$/.test(String(postResponse?.id)),
    'receipt id unavailable; do not retry POST'
  );
  assert(
    intent.repositoryId === LEDGER_REPOSITORY &&
      Number.isSafeInteger(intent.pullRequest) &&
      intent.pullRequest > 0,
    'receipt target mismatch'
  );
  const live = json(runner, [
    `repos/${repository}/pulls/${intent.pullRequest}/reviews/${postResponse.id}`,
  ]);
  const normalize = (value) => ({
    repositoryId: LEDGER_REPOSITORY,
    pullRequest: intent.pullRequest,
    id: String(value.id),
    authorId: String(value.user?.id),
    authorLogin: value.user?.login,
    commitId: value.commit_id,
    state: value.state,
    body: value.body,
  });
  const responseMatch = inspectCloudReviewReceipt(intent, normalize(postResponse));
  const liveMatch = inspectCloudReviewReceipt(intent, normalize(live));
  return {
    publicationAllowed: false,
    clearsSlot: false,
    authenticatedProducer: false,
    readbackMatches:
      String(live.id) === String(postResponse.id) && responseMatch.matches && liveMatch.matches,
    reason:
      'GET binding evidence only; supplied POST response cannot prove this invocation published it',
  };
}
