import fs from 'node:fs';
import path from 'node:path';
import {
  buildModelTraceRecord,
  computeModelTraceChallengeDigest,
  createModelTraceChallenge,
  renderModelTraceDisclosure,
} from '../../modeltrace.mjs';

// Synthetic failed-probe fixtures exercise disclosure/admission only. They
// never claim a fingerprint measurement of Main, a backend, or a real model.
const fixtures = new Map();
export function modelTraceFixture(repositoryId = 'github.com:Proto-UI/Proto-UI') {
  if (!fixtures.has(repositoryId)) {
    const modelTraceContext = {
      schemaVersion: 1,
      kind: 'proto-ui.modeltrace-context',
      repositoryId,
      sessionId: 'c'.repeat(64),
      contextDigest: 'a'.repeat(64),
      routeDigest: 'b'.repeat(64),
      declared: { systemModel: null, harnessModel: null },
    };
    const now = new Date();
    const challenge = createModelTraceChallenge(modelTraceContext, { now });
    const response = {
      schemaVersion: 1,
      kind: 'proto-ui.modeltrace-response',
      challengeDigest: computeModelTraceChallengeDigest(challenge),
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      method: 'active-model-literals',
      outputs: challenge.probes.map((probe) => ({
        id: probe.id,
        text: null,
        error: 'unavailable',
      })),
    };
    const record = buildModelTraceRecord(challenge, response);
    fixtures.set(repositoryId, {
      modelTrace: record.receipt,
      modelTraceContext,
      record,
      disclosure: renderModelTraceDisclosure(record.receipt),
    });
  }
  return fixtures.get(repositoryId);
}

export function writeModelTraceFixture(directory, repositoryId = 'github.com:Proto-UI/Proto-UI') {
  const fixture = modelTraceFixture(repositoryId);
  const recordPath = path.join(directory, 'modeltrace-record.json');
  const contextPath = path.join(directory, 'modeltrace-context.json');
  fs.writeFileSync(recordPath, JSON.stringify(fixture.record), { mode: 0o600 });
  fs.writeFileSync(contextPath, JSON.stringify(fixture.modelTraceContext), { mode: 0o600 });
  return {
    ...fixture,
    recordPath,
    contextPath,
    artifact: { type: 'modeltrace-record', reference: recordPath, digest: fixture.modelTrace.id },
  };
}
