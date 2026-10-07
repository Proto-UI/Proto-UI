// Inactive candidate only. No GitHub transport, credentials, or publication authority.
import { createHash } from 'node:crypto';
import {
  computeReviewInputDigest,
  computeReviewPacketDigest,
  renderReviewBody,
  validateReviewPacket,
  verifyLiveReviewInput,
  verifyReconciliation,
  isExactGovernedReviewDuplicate,
} from './review-runtime.mjs';

import {
  validateCloudReviewMaterial,
  cloudReviewMaterialDigest,
  cloudReviewMaterialReceipts,
} from './cloud-review-material.mjs';

export const INITIAL_SWEEP_ID = 'cyjin-yl-owner-requested-open-pr-sweep-2026-10-04';
export const LEDGER_REPOSITORY = 'github.com:Proto-UI/Proto-UI';
export const LEDGER_PRINCIPAL = Object.freeze({ id: '19223209', login: 'cyjin-yl' });
const HEX = /^[a-f0-9]{64}$/;
const OWNER = /^[a-f0-9]{32}$/;
const EVENT_KINDS = new Set([
  'initial-sweep',
  'opened',
  'reopened',
  'ready_for_review',
  'converted_to_draft',
  'closed',
  'synchronize',
  'human-review',
  'human-comment',
]);
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const hash = (text) => createHash('sha256').update(text).digest('hex');
function keys(value, fields) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'command must be an object');
  assert(
    Object.keys(value).length === fields.length &&
      fields.every((field) => Object.hasOwn(value, field)),
    'unexpected command fields'
  );
}
function pr(value) {
  assert(Number.isSafeInteger(value) && value > 0, 'invalid pull request');
}

export function emptyCloudReviewLedger({ publicationEnabled = false } = {}) {
  return {
    publicationEnabled,
    publicationReceipts: [],
    initialSweep: null,
    generation: 0,
    deliveries: [],
    deferred: [],
    material: [],
    pending: [],
    owners: [],
    analyses: [],
    publishedAnalyses: [],
    slot: null,
  };
}

export function validateCloudReviewAnalysis(command, state) {
  const { input, packet, liveInput, observation } = command;
  const duplicateCompletion = Object.hasOwn(command, 'duplicateReviewCompletionVersion');
  if (duplicateCompletion)
    assert(
      command.type === 'finishAnalysis' && command.duplicateReviewCompletionVersion === 1,
      'unsupported duplicate completion version'
    );
  if (Object.hasOwn(command, 'sweepCoverageVersion'))
    assert(command.sweepCoverageVersion === 1, 'unsupported sweep coverage version');
  if (Object.hasOwn(command, 'receiptNormalizationVersion'))
    assert(command.receiptNormalizationVersion === 1, 'unsupported receipt normalization version');
  keys(observation, [
    'executionMode',
    'executionModeSource',
    'reviewerId',
    'reviewerLogin',
    'authorId',
    'authorLogin',
    'policyDigest',
  ]);
  assert(
    observation.executionMode === 'autonomous' &&
      ['delegated-owner-event', 'delegated-owner-initial-sweep'].includes(
        observation.executionModeSource
      ),
    'event provenance must remain explicit'
  );
  assert(
    observation.reviewerId === LEDGER_PRINCIPAL.id &&
      observation.reviewerLogin === LEDGER_PRINCIPAL.login,
    'reviewer principal mismatch'
  );
  assert(
    typeof observation.authorId === 'string' &&
      /^[1-9][0-9]*$/.test(observation.authorId) &&
      typeof observation.authorLogin === 'string' &&
      /^[A-Za-z0-9-]{1,39}$/.test(observation.authorLogin),
    'author identity is unavailable'
  );
  assert(
    observation.authorId !== LEDGER_PRINCIPAL.id &&
      observation.authorLogin.toLowerCase() !== LEDGER_PRINCIPAL.login,
    'owner-authored PR is excluded'
  );
  assert(HEX.test(observation.policyDigest), 'recorded policy digest is required');
  if (observation.executionModeSource === 'delegated-owner-initial-sweep')
    assert(
      state.initialSweep?.pullRequests.includes(input.pullRequest) &&
        !state.initialSweep.completed.includes(input.pullRequest),
      'initial sweep inventory is absent or completed'
    );
  validateReviewPacket(packet, input);
  assert(packet.schemaVersion === 2, 'candidate requires evidence-bearing packet v2');
  assert(
    input.repositoryId === LEDGER_REPOSITORY && input.pullRequest === state.slot.pullRequest,
    'candidate target mismatch'
  );
  verifyLiveReviewInput(packet, liveInput);
  assert(
    state.pending.find((item) => item.pullRequest === input.pullRequest)?.generation ===
      state.slot.generation,
    'material generation changed during analysis'
  );
  const latest = state.analyses.find((item) => item.input.pullRequest === input.pullRequest);
  // The added field selects dual-baseline binding. Field-less commands retain
  // their historical sequential semantics when replaying immutable journals.
  const dualBaseline = Object.hasOwn(command, 'analysisReconciliation');
  const published = state.publishedAnalyses.find(
    (item) => item.input.pullRequest === input.pullRequest
  );
  const prior = dualBaseline || duplicateCompletion ? (published ?? latest) : latest;
  if (dualBaseline) {
    const separateAnalysis =
      latest &&
      prior &&
      computeReviewPacketDigest(latest.packet) !== computeReviewPacketDigest(prior.packet);
    if (separateAnalysis) {
      assert(command.analysisReconciliation !== null, 'latest analysis reconciliation is required');
      const analysisPacket = { ...packet, reconciliation: command.analysisReconciliation };
      validateReviewPacket(analysisPacket, input);
      verifyReconciliation(analysisPacket, latest.packet);
    } else
      assert(
        command.analysisReconciliation === null,
        'separate analysis reconciliation is not applicable'
      );
  }
  if (duplicateCompletion) {
    assert(
      prior &&
        !liveInput.isDraft &&
        isExactGovernedReviewDuplicate(packet, liveInput, LEDGER_PRINCIPAL.login, prior.packet),
      'exact governed duplicate and durable predecessor are required'
    );
  } else if (prior) {
    verifyReconciliation(packet, prior.packet);
    // Canonical runtime validates each referenced ID; require total prior coverage too.
    const classified = new Set([
      ...packet.reconciliation.openFindingIds,
      ...packet.reconciliation.resolvedFindingIds,
    ]);
    assert(
      prior.packet.findings.every((finding) => classified.has(finding.id)),
      'prior finding reconciliation is incomplete'
    );
  } else {
    assert(
      packet.reconciliation.priorPacketDigest === null &&
        packet.reconciliation.priorReviewedHeadSha === null,
      'durable prior analysis is unavailable'
    );
  }
  const material = state.material.find((item) => item.pullRequest === input.pullRequest);
  assert(material?.generation === state.slot.generation, 'claimed material lineage changed');
  return {
    input,
    packet,
    observation,
    ...(dualBaseline ? { analysisReconciliation: command.analysisReconciliation } : {}),
    ...(duplicateCompletion ? { duplicateReviewCompletionVersion: 1 } : {}),
    ...(Object.hasOwn(command, 'sweepCoverageVersion')
      ? { sweepCoverageVersion: command.sweepCoverageVersion }
      : {}),
    ...(Object.hasOwn(command, 'receiptNormalizationVersion')
      ? { receiptNormalizationVersion: command.receiptNormalizationVersion }
      : {}),
    materialDigest: material.digest,
    materialGeneration: material.generation,
    materialDeliveryId: material.deliveryId,
  };
}

function materialDigest(state, command) {
  return command.reviewMaterial
    ? cloudReviewMaterialDigest(command.reviewMaterial, cloudReviewMaterialReceipts(state))
    : command.materialDigest;
}

function admitMaterial(state, command) {
  const digest = materialDigest(state, command);
  const material = state.material.find((item) => item.pullRequest === command.pullRequest);
  if (material?.digest === digest) return;
  state.generation += 1;
  state.material = state.material.filter((item) => item.pullRequest !== command.pullRequest);
  // Derived only while replaying an admitted material change. Deferred commands
  // acquire their lineage here when drained, never from the currently fenced slot.
  state.material.push({
    pullRequest: command.pullRequest,
    digest,
    generation: state.generation,
    deliveryId: command.deliveryId,
  });
  state.pending = state.pending.filter((item) => item.pullRequest !== command.pullRequest);
  state.pending.push({ pullRequest: command.pullRequest, generation: state.generation });
}

function completeCoveredSweep(state, analysis) {
  const pullRequest = analysis.input.pullRequest;
  if (
    state.initialSweep?.sweepId !== INITIAL_SWEEP_ID ||
    !state.initialSweep.pullRequests.includes(pullRequest) ||
    state.initialSweep.completed.includes(pullRequest)
  )
    return;
  // Field-less historical commands retain exact-material coverage. Promoting a
  // historical B here could make its later, then-valid initial-source A finish
  // fail replay because completed would have changed earlier in that history.
  if (analysis.sweepCoverageVersion !== 1) {
    if (
      state.deliveries.some(
        (delivery) =>
          delivery.eventKind === 'initial-sweep' &&
          delivery.deliveryId === `${INITIAL_SWEEP_ID}:${pullRequest}` &&
          delivery.pullRequest === pullRequest &&
          delivery.materialDigest === analysis.materialDigest
      )
    )
      state.initialSweep.completed.push(pullRequest);
    return;
  }
  // Journal order distinguishes an actual later generation from an old fenced
  // analysis of the same digest (A -> C -> A). Include deferred deliveries when
  // locating what the sweep observed; they need not have been admitted yet.
  const deliveries = state.deliveries.filter((delivery) => delivery.pullRequest === pullRequest);
  const sweep = deliveries.findIndex(
    (delivery) =>
      delivery.eventKind === 'initial-sweep' &&
      delivery.deliveryId === `${INITIAL_SWEEP_ID}:${pullRequest}`
  );
  if (sweep < 0) return;
  let requiredStart = sweep;
  while (
    requiredStart > 0 &&
    materialDigest(state, deliveries[requiredStart - 1]) ===
      materialDigest(state, deliveries[sweep])
  )
    requiredStart--;
  const analyzedStart = deliveries.findIndex(
    (delivery) => delivery.deliveryId === analysis.materialDeliveryId
  );
  if (
    analyzedStart >= requiredStart &&
    materialDigest(state, deliveries[analyzedStart]) === analysis.materialDigest
  )
    state.initialSweep.completed.push(pullRequest);
}

function drainDeferred(state) {
  const deferred = state.deferred;
  state.deferred = [];
  for (const command of deferred) admitMaterial(state, command);
}

function complete(state, analysis = null, preserveAnalysis = false) {
  if (analysis) {
    if (
      analysis.sweepCoverageVersion !== 1 &&
      analysis.observation.executionModeSource === 'delegated-owner-initial-sweep'
    )
      state.initialSweep.completed.push(state.slot.pullRequest);
    else completeCoveredSweep(state, analysis);
    if (!preserveAnalysis) {
      state.analyses = state.analyses.filter(
        (item) => item.input.pullRequest !== state.slot.pullRequest
      );
      state.analyses.push(analysis);
    }
    if (analysis.publicationReceipt) {
      state.publishedAnalyses = state.publishedAnalyses.filter(
        (item) => item.input.pullRequest !== state.slot.pullRequest
      );
      state.publishedAnalyses.push(analysis);
    }
  }
  state.pending = state.pending.filter(
    (item) =>
      item.pullRequest !== state.slot.pullRequest || item.generation !== state.slot.generation
  );
  state.slot = null;
  drainDeferred(state);
}

// Replay only a verified journal prefix through this reducer; never trust a
// caller-provided cached state as durable history. Owner nonces are operational
// coordination, not signed identity or a sandbox against the account holder.
export function reduceCloudReviewLedger(previous, command) {
  const state = structuredClone(previous);
  assert(typeof state.publicationEnabled === 'boolean', 'ledger publication mode is invalid');
  if (command.type === 'captureInitialSweep') {
    keys(command, ['type', 'sweepId', 'pullRequests']);
    assert(
      state.publicationEnabled && state.initialSweep === null,
      'initial sweep is already captured or ledger disabled'
    );
    assert(command.sweepId === INITIAL_SWEEP_ID, 'initial sweep ID mismatch');
    assert(
      Array.isArray(command.pullRequests) && command.pullRequests.length <= 1000,
      'initial sweep inventory budget exceeded'
    );
    command.pullRequests.forEach(pr);
    assert(
      command.pullRequests.every(
        (value, index) => index === 0 || value > command.pullRequests[index - 1]
      ),
      'initial sweep inventory must be sorted and unique'
    );
    state.initialSweep = {
      sweepId: command.sweepId,
      pullRequests: command.pullRequests,
      completed: [],
    };
  } else if (command.type === 'enqueue') {
    keys(command, [
      'type',
      'deliveryId',
      'pullRequest',
      'eventKind',
      'materialDigest',
      ...(Object.hasOwn(command, 'reviewMaterial') ? ['reviewMaterial'] : []),
    ]);
    pr(command.pullRequest);
    assert(
      typeof command.deliveryId === 'string' && /^[A-Za-z0-9._:-]{1,160}$/.test(command.deliveryId),
      'invalid delivery id'
    );
    assert(EVENT_KINDS.has(command.eventKind), 'unsupported wake-up event');
    assert(HEX.test(command.materialDigest), 'invalid material digest');
    const existing = state.deliveries.find((item) => item.deliveryId === command.deliveryId);
    if (existing) {
      assert(
        existing.pullRequest === command.pullRequest &&
          existing.eventKind === command.eventKind &&
          existing.materialDigest === command.materialDigest &&
          Object.hasOwn(existing, 'reviewMaterial') === Object.hasOwn(command, 'reviewMaterial'),
        'delivery id reused with different evidence'
      );
    }
    if (Object.hasOwn(command, 'reviewMaterial')) {
      validateCloudReviewMaterial(command.reviewMaterial, LEDGER_REPOSITORY, command.pullRequest);
      assert(
        cloudReviewMaterialDigest(command.reviewMaterial) === command.materialDigest,
        'review material digest mismatch'
      );
    }
    if (existing) return state;
    if (command.eventKind === 'initial-sweep') {
      assert(
        state.initialSweep?.pullRequests.includes(command.pullRequest) &&
          !state.initialSweep.completed.includes(command.pullRequest),
        'PR is not in the incomplete initial sweep inventory'
      );
      assert(
        command.deliveryId === `${INITIAL_SWEEP_ID}:${command.pullRequest}`,
        'initial sweep delivery binding mismatch'
      );
    }
    state.deliveries.push(command);
    if (state.slot?.intent?.dispatchFenced && state.slot.pullRequest === command.pullRequest) {
      // Persist the wake-up, but serialize its generation after this dispatch.
      // No event is dropped or allowed to invalidate a reserved generation.
      const previous = state.deferred.findLast((item) => item.pullRequest === command.pullRequest);
      const latest = previous
        ? materialDigest(state, previous)
        : state.material.find((item) => item.pullRequest === command.pullRequest)?.digest;
      if (latest !== materialDigest(state, command)) state.deferred.push(command);
    } else admitMaterial(state, command);
    if (
      command.eventKind === 'initial-sweep' &&
      !state.pending.some((item) => item.pullRequest === command.pullRequest) &&
      state.slot?.pullRequest !== command.pullRequest
    ) {
      const analysis = state.analyses.find(
        (item) => item.input.pullRequest === command.pullRequest
      );
      if (analysis?.materialDigest === materialDigest(state, command))
        completeCoveredSweep(state, analysis);
    }
  } else if (command.type === 'claim') {
    keys(command, ['type', 'owner', 'pullRequest']);
    pr(command.pullRequest);
    assert(
      OWNER.test(command.owner) && !state.owners.includes(command.owner),
      'owner nonce is invalid or consumed'
    );
    assert(state.slot === null, 'global slot is occupied; no expiry or takeover');
    const pending = state.pending.find((item) => item.pullRequest === command.pullRequest);
    assert(pending, 'no pending admission');
    state.owners.push(command.owner);
    state.slot = { owner: command.owner, ...pending, intent: null };
  } else {
    assert(
      [
        'abandon',
        'finishAnalysis',
        'stageIntent',
        'stageSimulationIntent',
        'finalizeSimulation',
        'stagePublicationIntent',
        'cancelPublicationIntent',
        'finalizePublication',
      ].includes(command.type),
      'unsupported ledger transition'
    );
    assert(
      state.slot && state.slot.owner === command.owner,
      'only the current process owner may advance the slot'
    );
    if (command.type === 'cancelPublicationIntent') {
      keys(command, ['type', 'owner', 'intentId']);
      assert(
        state.publicationEnabled &&
          state.slot.intent?.publicationIntent === true &&
          state.slot.intent.dispatchFenced === true &&
          state.slot.intent.id === command.intentId,
        'exact owned publication intent required for pre-attempt cancellation'
      );
      // The process adapter additionally proves its one-time attempt is unconsumed.
      // Keep pending work and the immutable staged entry; cancellation is not analysis.
      state.slot = null;
      drainDeferred(state);
      return state;
    }
    if (['finalizeSimulation', 'finalizePublication'].includes(command.type)) {
      keys(command, ['type', 'owner', 'response', 'readback']);
      const intent = state.slot.intent;
      const publishing = command.type === 'finalizePublication';
      assert(
        publishing
          ? state.publicationEnabled &&
              intent?.publicationIntent === true &&
              intent.dispatchFenced === true
          : intent?.simulationOnly === true,
        publishing
          ? 'production intent and enabled ledger required'
          : 'only a simulation intent can be finalized'
      );
      assert(
        inspectCloudReviewReceipt(intent, command.response).matches &&
          inspectCloudReviewReceipt(intent, command.readback).matches &&
          command.response.id === command.readback.id,
        'simulation response and exact receipt readback must match'
      );
      const projected = publishing && intent.analysis.receiptNormalizationVersion === 1;
      if (projected)
        assert(
          typeof command.response.nodeId === 'string' &&
            command.response.nodeId.length > 0 &&
            command.response.nodeId === command.readback.nodeId,
          'versioned receipt node identity must match exact readback'
        );
      if (publishing)
        state.publicationReceipts.push({
          pullRequest: intent.pullRequest,
          id: command.response.id,
          headSha: intent.headSha,
          nodeId: command.response.nodeId ?? null,
          bodyDigest: intent.bodyDigest,
          packetDigest: intent.packetDigest,
          ...(projected ? { review: command.response } : {}),
        });
      complete(state, {
        ...intent.analysis,
        [publishing ? 'publicationReceipt' : 'simulationReceipt']: command.response,
      });
      return state;
    }
    assert(
      state.slot.intent === null,
      'unknown intent permanently blocks candidate release and takeover'
    );
    if (command.type === 'abandon') {
      keys(command, ['type', 'owner']);
      // No writer exists in this candidate. Preserve pending work on abandonment.
      state.slot = null;
    } else {
      keys(command, [
        'type',
        'owner',
        'input',
        'packet',
        'liveInput',
        'observation',
        ...(['finishAnalysis', 'stagePublicationIntent'].includes(command.type) &&
        Object.hasOwn(command, 'sweepCoverageVersion')
          ? ['sweepCoverageVersion']
          : []),
        ...(command.type === 'stagePublicationIntent' &&
        Object.hasOwn(command, 'receiptNormalizationVersion')
          ? ['receiptNormalizationVersion']
          : []),
        ...(command.type === 'finishAnalysis' &&
        Object.hasOwn(command, 'duplicateReviewCompletionVersion')
          ? ['duplicateReviewCompletionVersion']
          : []),
        ...(command.type === 'stagePublicationIntent' &&
        Object.hasOwn(command, 'analysisReconciliation')
          ? ['analysisReconciliation']
          : []),
      ]);
      const analysis = validateCloudReviewAnalysis(command, state);
      if (command.type === 'finishAnalysis')
        complete(state, analysis, analysis.duplicateReviewCompletionVersion === 1);
      else {
        assert(
          ['APPROVE', 'REQUEST_CHANGES'].includes(command.packet.recommendedAction),
          'intent requires a disposition candidate'
        );
        const packetDigest = computeReviewPacketDigest(command.packet);
        const id = hash(
          JSON.stringify([
            LEDGER_REPOSITORY,
            state.slot.owner,
            state.slot.generation,
            command.observation.policyDigest,
            packetDigest,
          ])
        );
        const publishing = command.type === 'stagePublicationIntent';
        assert(!publishing || state.publicationEnabled, 'publication ledger is not enabled');
        const body = publishing
          ? renderReviewBody(command.packet)
          : `${renderReviewBody(command.packet)}\n\nAI-executed candidate under delegated owner authority. Publication disabled.\n<!-- proto-ui:cloud-intent:${id} -->`;
        state.slot.intent = {
          id,
          status: 'unknown',
          publicationAllowed: false,
          repositoryId: LEDGER_REPOSITORY,
          pullRequest: command.input.pullRequest,
          baseSha: command.input.baseSha,
          headSha: command.input.headSha,
          inputDigest: computeReviewInputDigest(command.input),
          policyDigest: command.observation.policyDigest,
          packetDigest,
          principalId: LEDGER_PRINCIPAL.id,
          principalLogin: LEDGER_PRINCIPAL.login,
          recommendation: command.packet.recommendedAction,
          body,
          bodyDigest: hash(body),
          analysis,
          ...(command.type === 'stageSimulationIntent' ? { simulationOnly: true } : {}),
          ...(publishing ? { publicationIntent: true, dispatchFenced: true } : {}),
        };
      }
    }
  }
  return structuredClone(state);
}

// Supplied observations are not authenticated receipts. Matching never clears
// the slot and never grants publication; a future live collector owns that step.
export function inspectCloudReviewReceipt(intent, receipt) {
  const expectedState = { APPROVE: 'APPROVED', REQUEST_CHANGES: 'CHANGES_REQUESTED' }[
    intent?.recommendation
  ];
  const matches = Boolean(
    intent &&
    expectedState &&
    receipt?.repositoryId === intent.repositoryId &&
    receipt.pullRequest === intent.pullRequest &&
    receipt.authorId === intent.principalId &&
    receipt.authorLogin === intent.principalLogin &&
    receipt.commitId === intent.headSha &&
    receipt.state === expectedState &&
    typeof receipt.body === 'string' &&
    hash(receipt.body) === intent.bodyDigest &&
    receipt.body === intent.body &&
    typeof receipt.id === 'string' &&
    /^[1-9][0-9]*$/.test(receipt.id)
  );
  return { matches, authenticated: false, publicationAllowed: false, clearsSlot: false };
}
