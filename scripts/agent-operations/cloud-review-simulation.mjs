// Testable inactive writer/finalizer protocol. No network publisher is provided.
// An injected exchange is a test seam, not authority or a sandbox around credentials.
import { inspectCloudReviewReceipt } from './cloud-review-ledger.mjs';

const normalize = (intent, value) => ({
  repositoryId: intent.repositoryId,
  pullRequest: intent.pullRequest,
  id: String(value?.id),
  authorId: String(value?.user?.id),
  authorLogin: value?.user?.login,
  commitId: value?.commit_id,
  state: value?.state,
  body: value?.body,
});

export function simulateCloudReviewExchange(ledger, prepared, exchange, revalidate) {
  if (typeof revalidate !== 'function') throw new Error('final live revalidation is required');
  if (
    prepared?.publicationAllowed !== false ||
    prepared.mode !== 'dry-run' ||
    prepared.simulatedGatesPassed !== true ||
    prepared.intent?.simulationOnly !== true
  ) {
    throw new Error('only a prepared simulation may exercise this inactive exchange');
  }
  const before = ledger.read();
  if (
    before.state.slot?.intent?.id !== prepared.intent.id ||
    before.state.slot.intent.simulationOnly !== true
  )
    throw new Error('simulation intent is not current');
  // Capture the request from the durable intent, not mutable caller request fields.
  const intent = structuredClone(before.state.slot.intent);
  ledger.consumeSimulationAttempt(intent.id);
  const request = { commit_id: intent.headSha, event: intent.recommendation, body: intent.body };
  let response;
  try {
    revalidate();
    const final = ledger.read().state;
    if (
      final.slot?.intent?.id !== intent.id ||
      final.pending.find((item) => item.pullRequest === intent.pullRequest)?.generation !==
        final.slot.generation
    ) {
      throw new Error('material generation changed before simulation request');
    }
    // Exactly one injected fake submit. Never recover by accepting an unsolicited
    // matching review if this call throws or its response cannot be bound.
    response = normalize(intent, exchange.submitOnce(request));
    if (!inspectCloudReviewReceipt(intent, response).matches) throw new Error('unbound response');
    const readback = normalize(intent, exchange.readReview(response.id));
    if (response.id !== readback.id || !inspectCloudReviewReceipt(intent, readback).matches) {
      throw new Error('unbound readback');
    }
    const current = ledger.read();
    const result = ledger.apply(current.revision, {
      type: 'finalizeSimulation',
      response,
      readback,
    });
    if (result.status !== 'applied') throw new Error('simulation finalizer was not acknowledged');
    return {
      status: 'simulated',
      publicationAllowed: false,
      response,
      checkpoint: result.checkpoint ?? result.revision,
    };
  } catch (error) {
    return {
      status: 'unknown',
      publicationAllowed: false,
      reason: error.message,
      retryAllowed: false,
    };
  }
}
