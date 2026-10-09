// Parent-owned review session. No model/reviewer is invoked by this helper.
import { createHash } from 'node:crypto';
import { assertModelTraceDisclosure, assertModelTraceFresh } from './modeltrace.mjs';
import { validateSelfAssessmentResult, isSelfAssessmentFresh } from './assessment-runtime.mjs';
import {
  authorizeReviewSubmission,
  computeReviewInputDigest,
  verifyLiveReviewInput,
} from './review-runtime.mjs';
import { summarizeLiveChecks, summarizeLiveDco } from './collect-live-review-input.mjs';
import {
  LEDGER_PRINCIPAL,
  LEDGER_REPOSITORY,
  INITIAL_SWEEP_ID,
  validateCloudReviewAnalysis,
  reduceCloudReviewLedger,
} from './cloud-review-ledger.mjs';

import {
  validateCloudReviewMaterial,
  cloudReviewMaterialDigest,
  cloudReviewMaterialReceipts,
  matchesCloudReviewMaterialReceipt,
} from './cloud-review-material.mjs';

export const CONNECTOR_AUTHORIZATION = 'proto-ui-cloud-owner-review-v1';
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hash = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const INITIAL_SWEEP_AUTHORIZATION = 'proto-ui-cloud-owner-initial-sweep-v1';
export { INITIAL_SWEEP_ID };
const identity = (live) => [
  live.reviewerId,
  live.viewerLogin,
  live.authorId,
  live.authorLogin,
  live.permission,
  live.contributors,
];

// Field binding is operational admission, not authenticated runtime attestation.
export function isConnectorReviewScopeActive(policy, authorizationId) {
  const source =
    authorizationId === CONNECTOR_AUTHORIZATION
      ? 'delegated-owner-event'
      : authorizationId === INITIAL_SWEEP_AUTHORIZATION
        ? 'delegated-owner-initial-sweep'
        : null;
  if (!source || !Array.isArray(policy?.reviewSubmissionAuthorizations)) return false;
  const matches = policy.reviewSubmissionAuthorizations.filter(
    (scope) => scope?.id === authorizationId
  );
  if (matches.length !== 1) return false;
  const scope = matches[0];
  return (
    scope.status === 'active' &&
    scope.repositoryId === LEDGER_REPOSITORY &&
    scope.executionMode === 'autonomous' &&
    scope.executionModeSource === source &&
    scope.mutationClass === 'conditional-review-submission' &&
    scope.principalId === LEDGER_PRINCIPAL.id &&
    scope.principalLogin === LEDGER_PRINCIPAL.login &&
    (authorizationId !== INITIAL_SWEEP_AUTHORIZATION || scope.initialSweepId === INITIAL_SWEEP_ID)
  );
}

export class ConnectorReviewSession {
  #transport;
  #ledger;
  #policy;
  #initial;
  #readPolicy;
  #readSnapshot;
  #priorPacket = null;
  #claim = null;
  #used = false;
  #source = 'delegated-owner-event';
  #authorizationId = CONNECTOR_AUTHORIZATION;
  constructor({ transport, ledger, readPolicy, readSnapshot }) {
    this.#transport = transport;
    this.#ledger = ledger;
    assert(
      typeof readPolicy === 'function' && typeof readSnapshot === 'function',
      'trusted live policy and snapshot readers required'
    );
    this.#readPolicy = readPolicy;
    this.#readSnapshot = readSnapshot;
    this.#policy = readPolicy();
  }
  #refreshPolicy() {
    const current = this.#readPolicy();
    assert(
      hash(current) === hash(this.#policy) && current.__digest === this.#policy.__digest,
      'policy changed or authorization revoked; restart with current scope'
    );
    this.#policy = current;
  }
  async captureInitialSweep() {
    this.#refreshPolicy();
    this.#checkSweepScope();
    const before = await this.#ledger.read();
    assert(
      before.state.publicationEnabled === true,
      'production ledger must be explicitly provisioned'
    );
    if (before.state.initialSweep)
      return { status: 'captured', inventory: before.state.initialSweep };
    const pullRequests = await this.#transport.collectInitialSweep();
    this.#refreshPolicy();
    const applied = await this.#ledger.apply(before.revision, {
      type: 'captureInitialSweep',
      sweepId: INITIAL_SWEEP_ID,
      pullRequests,
    });
    if (applied.status !== 'applied') return applied;
    const confirmed = await this.#ledger.read();
    this.#refreshPolicy();
    assert(
      confirmed.state.initialSweep?.sweepId === INITIAL_SWEEP_ID &&
        hash(confirmed.state.initialSweep.pullRequests) === hash(pullRequests),
      'captured inventory readback mismatch'
    );
    return { ...applied, inventory: confirmed.state.initialSweep };
  }
  #checkSweepScope() {
    assert(
      isConnectorReviewScopeActive(this.#policy, INITIAL_SWEEP_AUTHORIZATION),
      'initial sweep needs its separately admitted exact scope'
    );
  }
  async begin(pullRequest, event) {
    this.#refreshPolicy();
    assert(!this.#initial && !this.#used, 'one parent-review lifecycle per session');
    assert(
      event &&
        [
          'opened',
          'reopened',
          'ready_for_review',
          'converted_to_draft',
          'closed',
          'synchronize',
          'human-review',
          'human-comment',
        ].includes(event.kind),
      'unsupported event hint'
    );
    assert(
      isConnectorReviewScopeActive(this.#policy, CONNECTOR_AUTHORIZATION),
      'event scope is not active'
    );
    this.#source = 'delegated-owner-event';
    this.#authorizationId = CONNECTOR_AUTHORIZATION;
    return this.#begin(pullRequest, event);
  }
  async beginInitialSweep(pullRequest) {
    assert(!this.#initial && !this.#used, 'one parent-review lifecycle per session');
    this.#refreshPolicy();
    this.#checkSweepScope();
    const { state } = await this.#ledger.read();
    assert(
      state.initialSweep?.pullRequests.includes(pullRequest),
      'PR is not in the captured initial sweep inventory'
    );
    if (state.initialSweep.completed.includes(pullRequest))
      return {
        skipped: true,
        reason: 'initial sweep item already completed',
        publicationAllowed: false,
      };
    this.#source = 'delegated-owner-initial-sweep';
    this.#authorizationId = INITIAL_SWEEP_AUTHORIZATION;
    return this.#begin(pullRequest, {
      kind: 'initial-sweep',
      deliveryId: `${INITIAL_SWEEP_ID}:${pullRequest}`,
    });
  }
  async #begin(pullRequest, event) {
    const live = await this.#transport.collect(pullRequest);
    if (event.kind === 'initial-sweep')
      assert(
        live.input.pullRequestState === 'OPEN',
        'initial sweep admits only currently open PRs'
      );
    const before = await this.#ledger.read();
    assert(
      before.state.publicationEnabled === true,
      'production ledger must be explicitly provisioned'
    );
    const reviewMaterial = {
      version: 1,
      input: live.input,
      reviewIdentities: live.reviewIdentities,
    };
    validateCloudReviewMaterial(reviewMaterial, LEDGER_REPOSITORY, pullRequest);
    const receipts = cloudReviewMaterialReceipts(before.state);
    const digest = cloudReviewMaterialDigest(reviewMaterial, receipts);
    // A proven own-review hint may save a no-op journal write only after all
    // other collected material was compared. Never discard concurrent changes.
    if (
      event.kind === 'human-review' &&
      event.reviewId &&
      receipts.some(
        (receipt) =>
          receipt.id === String(event.reviewId) &&
          live.input.reviews.some((_, index) =>
            matchesCloudReviewMaterialReceipt(reviewMaterial, index, receipt)
          )
      ) &&
      before.state.material.some(
        (item) => item.pullRequest === pullRequest && item.digest === digest
      ) &&
      !before.state.pending.some((item) => item.pullRequest === pullRequest) &&
      !before.state.deferred.some((item) => item.pullRequest === pullRequest)
    ) {
      const existing = before.state.deliveries.find((item) => item.deliveryId === event.deliveryId);
      assert(
        !existing ||
          (existing.pullRequest === pullRequest &&
            existing.eventKind === event.kind &&
            existing.reviewMaterial &&
            existing.materialDigest === cloudReviewMaterialDigest(reviewMaterial)),
        'delivery id reused with different evidence'
      );
      return { skipped: true, reason: 'own published review wake-up', publicationAllowed: false };
    }
    this.#refreshPolicy();
    const queued = await this.#ledger.apply(before.revision, {
      type: 'enqueue',
      deliveryId: event.deliveryId,
      pullRequest,
      eventKind: event.kind,
      materialDigest: cloudReviewMaterialDigest(reviewMaterial),
      reviewMaterial,
    });
    assert(queued.status === 'applied', 'enqueue not confirmed; stop without retry');
    const admitted = await this.#ledger.read();
    if (!admitted.state.pending.some((x) => x.pullRequest === pullRequest))
      return { skipped: true, reason: 'unchanged material', publicationAllowed: false };
    if (admitted.state.slot !== null)
      return { queued: true, reason: 'global slot occupied', publicationAllowed: false };
    this.#refreshPolicy();
    const claimed = await this.#ledger.apply(admitted.revision, { type: 'claim', pullRequest });
    assert(claimed.status === 'applied', 'claim not confirmed; stop without retry');
    this.#claim = structuredClone((await this.#ledger.read()).state.slot);
    this.#initial = structuredClone(live);
    const priorAnalysis =
      admitted.state.analyses.find((x) => x.input.pullRequest === pullRequest) ?? null;
    const priorPublishedAnalysis =
      admitted.state.publishedAnalyses.find((x) => x.input.pullRequest === pullRequest) ?? null;
    this.#priorPacket = (priorPublishedAnalysis ?? priorAnalysis)?.packet ?? null;
    return {
      kind: 'proto-ui.parent-review-request',
      executionMode: 'autonomous',
      executionModeSource: this.#source,
      input: structuredClone(live.input),
      inputDigest: computeReviewInputDigest(live.input),
      identity: identity(live),
      coverage: live.coverage,
      priorAnalysis,
      priorPublishedAnalysis,
      instruction:
        'Parent inspects actual diff and evidence, reconciles prior findings, and supplies its own packet; helper does not judge.',
    };
  }
  #authorize(packet, live, assessment, permitDuplicate = false, measured = {}) {
    this.#refreshPolicy();
    validateSelfAssessmentResult(assessment, this.#policy);
    const snapshot = this.#readSnapshot();
    assert(
      isSelfAssessmentFresh(assessment, snapshot) &&
        assessment.scope.worktreeDigest === snapshot.worktreeDigest,
      'self assessment is stale or expired'
    );
    assert(
      assessment.scope.repositoryId === LEDGER_REPOSITORY,
      'self assessment repository mismatch'
    );
    assert(
      !live.contributionGap && !live.contributed,
      'independent contributor identity unavailable or reviewer contributed'
    );
    assert(
      hash(identity(live)) === hash(identity(this.#initial)),
      'live identity/permission changed'
    );
    assert(
      packet.agentEvidence?.source?.includes('AI-executed review by ChatGPT'),
      'honest AI attribution required in rendered evidence'
    );
    assert(
      packet.agentEvidence.disposition === 'complete' &&
        packet.agentEvidence.debt.length === 0 &&
        packet.humanGates.length === 0,
      'complete evidence and no human-maintainer judgment gate required'
    );
    assert(!live.input.isDraft, 'draft pull requests are analysis-only');
    const authorization = authorizeReviewSubmission({
      modelTrace: measured.modelTrace,
      modelTraceContext: measured.modelTraceContext,
      packet,
      input: this.#initial.input,
      liveInput: live.input,
      executionMode: 'autonomous',
      executionModeSource: this.#source,
      authorizationId: this.#authorizationId,
      policy: this.#policy,
      priorPacket: this.#priorPacket,
      dcoConclusion: summarizeLiveDco(live.input.checks, {
        repositoryId: LEDGER_REPOSITORY,
        trustedRepositoryId: this.#policy.trustedDcoEvidence?.repositoryId,
        trustedCheckName: this.#policy.trustedDcoEvidence?.checkName,
        trustedSource: this.#policy.trustedDcoEvidence?.source,
        trustedProviderId: this.#policy.trustedDcoEvidence?.providerId,
        trustedDetailsUrl: this.#policy.trustedDcoEvidence?.detailsUrl,
      }),
      selfAssessment: { ...assessment, validated: true, fresh: true },
      credentialCanReview: ['admin', 'write', 'maintain'].includes(live.permission),
      reviewer: live.viewerLogin,
      pullRequestAuthor: live.authorLogin,
      ciConclusion: summarizeLiveChecks(live.input.checks, {
        repositoryId: LEDGER_REPOSITORY,
        trustedRepositoryId: this.#policy.trustedCiEvidence?.repositoryId,
        trustedSource: this.#policy.trustedCiEvidence?.source,
        trustedCheckNames: this.#policy.trustedCiEvidence?.checkNames,
        trustedWorkflowNames: this.#policy.trustedCiEvidence?.workflowNames,
        trustedWorkflowPaths: this.#policy.trustedCiEvidence?.workflowPaths,
      }),
    });
    assert(
      authorization.allowed || (permitDuplicate && authorization.duplicate),
      `canonical publication gate: ${authorization.reason}`
    );
    assert(
      isConnectorReviewScopeActive(this.#policy, this.#authorizationId),
      'standing scope principal or complete binding mismatch'
    );
    return authorization;
  }
  async #persistPublicationReceipt(intent, receipt) {
    // A definitive CAS conflict proves no receipt state update was applied. Only that
    // outcome may retry, while the same owner/intent remains fenced. The ledger
    // adapter still enforces process ownership and stops on ambiguous writes.
    for (let attempt = 0; attempt < 3; attempt++) {
      const snapshot = await this.#ledger.read();
      assert(
        snapshot.state.slot?.intent?.dispatchFenced === true &&
          hash(snapshot.state.slot.intent) === hash(intent),
        'fenced publication intent changed during receipt persistence'
      );
      const command = {
        type: 'finalizePublication',
        response: receipt,
        readback: receipt,
      };
      // Compute follow-up from the exact candidate after receipt-aware draining,
      // not the raw deferred list that still includes an unconfirmed self echo.
      const next = reduceCloudReviewLedger(snapshot.state, {
        ...command,
        owner: snapshot.state.slot.owner,
      });
      const followUpQueued = next.pending.some((item) => item.pullRequest === intent.pullRequest);
      const finalized = await this.#ledger.apply(snapshot.revision, command);
      if (finalized.status === 'applied') return { finalized, followUpQueued };
      assert(
        finalized.status === 'conflict',
        'publication receipt persistence uncertain; no retry'
      );
    }
    throw new Error('publication receipt persistence contention budget exhausted');
  }
  async #releaseUnstagedClaim() {
    for (let attempt = 0; attempt < 3; attempt++) {
      const snapshot = await this.#ledger.read();
      assert(
        this.#claim?.intent === null && hash(snapshot.state.slot) === hash(this.#claim),
        'cannot abandon: original intent-free claim changed before release'
      );
      const released = await this.#ledger.apply(snapshot.revision, { type: 'abandon' });
      if (released.status === 'applied') return released;
      assert(released.status === 'conflict', 'intent-free claim release uncertain; no retry');
    }
    throw new Error('intent-free claim release contention budget exhausted');
  }
  async publishParentPacket(
    packet,
    assessment,
    analysisReconciliation = null,
    measuredInputs = {}
  ) {
    // Snapshot caller-owned measured inputs once; both pre-stage and final
    // authorization validate this same receipt/context, never body text alone.
    const measured = structuredClone({
      modelTrace: measuredInputs.modelTrace,
      modelTraceContext: measuredInputs.modelTraceContext,
    });
    assert(
      this.#initial && !this.#used,
      'parent-review request required; one publication attempt per session'
    );
    this.#used = true;
    let live;
    let intent;
    let stagingStarted = false;
    let terminalStarted = false;
    try {
      live = await this.#transport.collect(this.#initial.input.pullRequest);
      const authorization = this.#authorize(packet, live, assessment, true, measured);
      if (authorization.duplicate) {
        terminalStarted = true;
        const finished = await this.#completeParentAnalysis(packet, true);
        return {
          ...finished,
          status: 'duplicate',
          duplicate: true,
          submitted: false,
          publicationConfirmed: false,
        };
      }
      const before = await this.#ledger.read();
      this.#refreshPolicy();
      const command = {
        type: 'stagePublicationIntent',
        sweepCoverageVersion: 1,
        receiptNormalizationVersion: 1,
        analysisReconciliation,
        input: this.#initial.input,
        packet,
        liveInput: live.input,
        observation: {
          executionMode: 'autonomous',
          executionModeSource: this.#source,
          reviewerId: live.reviewerId,
          reviewerLogin: live.viewerLogin,
          authorId: live.authorId,
          authorLogin: live.authorLogin,
          policyDigest: hash(this.#policy),
        },
      };
      // Prove deterministic binding failures before starting the journal write;
      // the adapter repeats the same validation under its exact-revision CAS.
      validateCloudReviewAnalysis(command, before.state);
      stagingStarted = true;
      const staged = await this.#ledger.apply(before.revision, command);
      if (staged.status === 'conflict') stagingStarted = false;
      assert(
        staged.status === 'applied',
        'intent acknowledgement unavailable; never submit or retry'
      );
      intent = (await this.#ledger.read()).state.slot.intent;
    } catch (error) {
      // Read-only/preflight failures or a definitive no-write fence conflict
      // cannot have dispatched. Never infer that from an ambiguous stage/readback.
      if (!stagingStarted && !terminalStarted) {
        try {
          await this.#releaseUnstagedClaim();
        } catch (failure) {
          error.message += `; claim release unknown: ${failure.message}`;
        }
      }
      throw error;
    }
    let confirmedReceipt = null;
    let attemptConsumed = false;
    try {
      const final = await this.#transport.collect(live.input.pullRequest);
      verifyLiveReviewInput(intent.analysis.packet, final.input);
      const current = (await this.#ledger.read()).state;
      assert(
        current.slot?.intent?.id === intent.id &&
          current.pending.find((x) => x.pullRequest === intent.pullRequest)?.generation ===
            current.slot.generation,
        'material generation changed before review request'
      );
      this.#authorize(intent.analysis.packet, final, assessment, false, measured);
      await this.#ledger.consumePublicationAttempt(intent.id);
      attemptConsumed = true;
      this.#refreshPolicy();
      // The durable attempt fence can await remote ledger IO. Recheck the same
      // measured tuple at dispatch; expiry here stays consumed/unknown, no retry.
      assertModelTraceFresh(measured.modelTrace, measured.modelTraceContext, {
        repositoryId: intent.analysis.packet.repositoryId,
      });
      assertModelTraceDisclosure(intent.body, measured.modelTrace);
      const receipt = await this.#transport.submit(intent.pullRequest, intent);
      confirmedReceipt = receipt;
      // The API acknowledges a review of one commit, never approval of a later head.
      // Observe immediately, without retrying/dismissing the known published review.
      let observedHeadSha = null;
      let followUpError = null;
      try {
        observedHeadSha = await this.#transport.observeHead(intent.pullRequest);
        if (observedHeadSha !== intent.headSha) {
          this.#refreshPolicy();
          assert(
            isConnectorReviewScopeActive(this.#policy, CONNECTOR_AUTHORIZATION),
            'new-head follow-up needs the separately active event scope'
          );
          const followUp = await this.#ledger.read();
          const queued = await this.#ledger.apply(followUp.revision, {
            type: 'enqueue',
            deliveryId: `post-review:${receipt.id}:${observedHeadSha}`,
            pullRequest: intent.pullRequest,
            eventKind: 'synchronize',
            materialDigest: hash({ observedHeadSha, publishedReviewId: receipt.id }),
          });
          assert(queued.status === 'applied', 'new-head follow-up acknowledgement unavailable');
        }
      } catch (error) {
        followUpError = error.message;
      }
      const { finalized, followUpQueued } = await this.#persistPublicationReceipt(intent, receipt);
      return {
        status: 'published',
        reviewedHeadSha: intent.headSha,
        observedHeadSha,
        followUpRequired:
          followUpQueued || observedHeadSha !== intent.headSha || followUpError !== null,
        followUpQueued,
        followUpError,
        receipt,
        checkpoint: finalized.checkpoint ?? finalized.revision,
        retryAllowed: false,
      };
    } catch (error) {
      let cancellationError = null;
      if (!attemptConsumed) {
        try {
          // Only this still-owning process can prove that dispatch never began.
          // A definitive no-write conflict may be retried; uncertain writes cannot.
          for (let attempt = 0; attempt < 3; attempt++) {
            const snapshot = await this.#ledger.read();
            assert(
              hash(snapshot.state.slot?.intent) === hash(intent),
              'publication intent changed before cancellation'
            );
            const cancelled = await this.#ledger.apply(snapshot.revision, {
              type: 'cancelPublicationIntent',
              intentId: intent.id,
            });
            if (cancelled.status === 'applied')
              return {
                status: 'cancelled',
                intentId: intent.id,
                reason: error.message,
                retryAllowed: false,
                publicationConfirmed: false,
                checkpoint: cancelled.checkpoint ?? cancelled.revision,
              };
            assert(cancelled.status === 'conflict', 'pre-attempt cancellation uncertain; no retry');
          }
          throw new Error('pre-attempt cancellation contention budget exhausted');
        } catch (failure) {
          cancellationError = failure.message;
        }
      }
      return {
        status: 'unknown',
        intentId: intent.id,
        reason: error.message,
        retryAllowed: false,
        publicationConfirmed: confirmedReceipt !== null,
        ...(cancellationError ? { cancellationError } : {}),
        ...(confirmedReceipt ? { receipt: confirmedReceipt, reviewedHeadSha: intent.headSha } : {}),
      };
    }
  }
  async abandonBeforeIntent() {
    this.#used = true;
    return this.#releaseUnstagedClaim();
  }
  async finishParentAnalysis(packet) {
    assert(
      this.#initial && !this.#used,
      'parent-review request required; lifecycle already consumed'
    );
    this.#used = true;
    return this.#completeParentAnalysis(packet);
  }
  async #completeParentAnalysis(packet, duplicateCompletion = false) {
    let finishingStarted = false;
    try {
      const live = await this.#transport.collect(this.#initial.input.pullRequest);
      assert(
        hash(identity(live)) === hash(identity(this.#initial)),
        'live identity/permission changed'
      );
      const snapshot = await this.#ledger.read();
      this.#refreshPolicy();
      const command = {
        type: 'finishAnalysis',
        sweepCoverageVersion: 1,
        ...(duplicateCompletion ? { duplicateReviewCompletionVersion: 1 } : {}),
        input: this.#initial.input,
        packet,
        liveInput: live.input,
        observation: {
          executionMode: 'autonomous',
          executionModeSource: this.#source,
          reviewerId: live.reviewerId,
          reviewerLogin: live.viewerLogin,
          authorId: live.authorId,
          authorLogin: live.authorLogin,
          policyDigest: hash(this.#policy),
        },
      };
      // Separate deterministic rejection from an uncertain journal write, just
      // as publication staging does. The adapter validates again under CAS.
      validateCloudReviewAnalysis(command, snapshot.state);
      finishingStarted = true;
      const finished = await this.#ledger.apply(snapshot.revision, command);
      if (finished.status === 'conflict') finishingStarted = false;
      assert(finished.status === 'applied', 'analysis acknowledgement unavailable; never retry');
      return finished;
    } catch (error) {
      // Releasing a proven unwritten finish preserves pending work; it must
      // never be returned as a durable completion of the rejected analysis.
      if (!finishingStarted) {
        try {
          await this.#releaseUnstagedClaim();
        } catch (failure) {
          error.message += `; claim release unknown: ${failure.message}`;
        }
      }
      throw error;
    }
  }
}
