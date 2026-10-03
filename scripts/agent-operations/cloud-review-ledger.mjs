// Inactive candidate only. No GitHub transport, credentials, or publication authority.
import { createHash } from 'node:crypto';
import {
  computeReviewInputDigest,
  computeReviewPacketDigest,
  renderReviewBody,
  validateReviewPacket,
  verifyLiveReviewInput,
  verifyReconciliation,
} from './review-runtime.mjs';

export const INITIAL_SWEEP_ID = 'owner-requested-open-pr-sweep-2026-10-03';
export const LEDGER_REPOSITORY = 'github.com:Proto-UI/Proto-UI';
export const LEDGER_PRINCIPAL = Object.freeze({ id: '52768321', login: 'guangliang2019' });
const HEX = /^[a-f0-9]{64}$/;
const OWNER = /^[a-f0-9]{32}$/;
const EVENT_KINDS = new Set([
  'initial-sweep',
  'opened',
  'ready_for_review',
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
    slot: null,
  };
}

function binding(command, state) {
  const { input, packet, liveInput, observation } = command;
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
  const prior = state.analyses.find((item) => item.input.pullRequest === input.pullRequest);
  if (prior) {
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
  return { input, packet, observation };
}

function admitMaterial(state, command) {
  const material = state.material.find((item) => item.pullRequest === command.pullRequest);
  if (material?.digest === command.materialDigest) return;
  state.generation += 1;
  state.material = state.material.filter((item) => item.pullRequest !== command.pullRequest);
  state.material.push({ pullRequest: command.pullRequest, digest: command.materialDigest });
  state.pending = state.pending.filter((item) => item.pullRequest !== command.pullRequest);
  state.pending.push({ pullRequest: command.pullRequest, generation: state.generation });
}

function complete(state, analysis = null) {
  if (analysis) {
    if (analysis.observation.executionModeSource === 'delegated-owner-initial-sweep')
      state.initialSweep.completed.push(state.slot.pullRequest);
    state.analyses = state.analyses.filter(
      (item) => item.input.pullRequest !== state.slot.pullRequest
    );
    state.analyses.push(analysis);
  }
  state.pending = state.pending.filter(
    (item) =>
      item.pullRequest !== state.slot.pullRequest || item.generation !== state.slot.generation
  );
  state.slot = null;
  const deferred = state.deferred;
  state.deferred = [];
  for (const command of deferred) admitMaterial(state, command);
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
    keys(command, ['type', 'deliveryId', 'pullRequest', 'eventKind', 'materialDigest']);
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
          existing.materialDigest === command.materialDigest,
        'delivery id reused with different evidence'
      );
      return state;
    }
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
      const latest =
        state.deferred.findLast((item) => item.pullRequest === command.pullRequest)
          ?.materialDigest ??
        state.material.find((item) => item.pullRequest === command.pullRequest)?.digest;
      if (latest !== command.materialDigest) state.deferred.push(command);
    } else admitMaterial(state, command);
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
        'finalizePublication',
      ].includes(command.type),
      'unsupported ledger transition'
    );
    assert(
      state.slot && state.slot.owner === command.owner,
      'only the current process owner may advance the slot'
    );
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
      if (publishing)
        state.publicationReceipts.push({
          pullRequest: intent.pullRequest,
          id: command.response.id,
          headSha: intent.headSha,
          nodeId: command.response.nodeId ?? null,
          bodyDigest: intent.bodyDigest,
          packetDigest: intent.packetDigest,
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
      keys(command, ['type', 'owner', 'input', 'packet', 'liveInput', 'observation']);
      const analysis = binding(command, state);
      if (command.type === 'finishAnalysis') complete(state, analysis);
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
