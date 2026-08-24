import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const EVENT_SHADOW_VERSION = '2026-08-24.event-shadow';
export const MAX_EVENT_PAYLOAD_BYTES = 2 * 1024 * 1024;
export const MAX_EVENT_STATE_ENTRIES = 10_000;

const DELIVERY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA = /^[0-9a-f]{40}$/;
const DIGEST = /^[0-9a-f]{64}$/;
const OBJECT_KEY = /^repository:[1-9][0-9]*:pull-request:[1-9][0-9]*$/;
const OUTCOMES = new Set([
  'ADMITTED',
  'DUPLICATE',
  'UNSUPPORTED',
  'SELF_ECHO',
  'OUT_OF_ORDER',
  'AMBIGUOUS_ORDER',
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function integer(value, label) {
  const parsed = typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;
  assert(Number.isSafeInteger(parsed) && parsed > 0, `${label} must be a positive integer`);
  return parsed;
}

function dateTime(value, label) {
  assert(typeof value === 'string' && !Number.isNaN(Date.parse(value)), `${label} is invalid`);
  return new Date(value).toISOString();
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isCanonicalDateTime(value) {
  return (
    typeof value === 'string' &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

function isRepositoryFullName(value) {
  return typeof value === 'string' && /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value);
}

function headerMap(headers) {
  assert(isObject(headers), 'webhook headers must be an object');
  const normalized = {};
  for (const [name, value] of Object.entries(headers)) {
    assert(typeof value === 'string' && value.length > 0, `webhook header ${name} is invalid`);
    const canonicalName = name.toLowerCase();
    assert(!Object.hasOwn(normalized, canonicalName), `duplicate webhook header: ${canonicalName}`);
    normalized[canonicalName] = value;
  }
  return normalized;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map((key) => [key, canonicalize(value[key])])
  );
}

function digest(value) {
  const bytes = Buffer.isBuffer(value)
    ? value
    : Buffer.from(JSON.stringify(canonicalize(value)), 'utf8');
  return createHash('sha256').update(bytes).digest('hex');
}

function objectKeyForEnvelope(envelope) {
  return `repository:${envelope.repository?.id}:${envelope.object?.kind}:${envelope.object?.number}`;
}

function exactKeys(value, expected, label, issues) {
  if (!isObject(value)) {
    issues.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) {
    issues.push(`${label} keys must be exactly ${wanted.join(', ')}`);
  }
}

export function computeWebhookSignature(rawBody, secret) {
  assert(Buffer.isBuffer(rawBody), 'raw webhook body must be a Buffer');
  assert(typeof secret === 'string' && secret.length >= 1, 'webhook secret is required');
  return `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
}

export function verifyWebhookSignature(rawBody, secret, signature) {
  assert(
    typeof signature === 'string' && /^sha256=[0-9a-f]{64}$/.test(signature),
    'webhook signature must use X-Hub-Signature-256'
  );
  const expected = Buffer.from(computeWebhookSignature(rawBody, secret), 'utf8');
  const actual = Buffer.from(signature, 'utf8');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function validateTrust(trust) {
  assert(isObject(trust), 'webhook trust anchors are required');
  const repositoryId = integer(trust.repositoryId, 'trusted repository id');
  assert(
    typeof trust.repositoryFullName === 'string' &&
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(trust.repositoryFullName),
    'trusted repository name is invalid'
  );
  assert(Array.isArray(trust.hookIds) && trust.hookIds.length > 0, 'trusted hook ids are required');
  assert(
    Array.isArray(trust.installationIds) && trust.installationIds.length > 0,
    'trusted installation ids are required'
  );
  return {
    repositoryId,
    repositoryFullName: trust.repositoryFullName,
    hookIds: trust.hookIds.map((value) => integer(value, 'trusted hook id')),
    installationIds: trust.installationIds.map((value) =>
      integer(value, 'trusted installation id')
    ),
  };
}

export function normalizeGithubWebhook({ rawBody, headers, secret, trust, observedAt }) {
  assert(Buffer.isBuffer(rawBody), 'raw webhook body must be a Buffer');
  assert(rawBody.length > 0, 'raw webhook body is empty');
  assert(
    rawBody.length <= MAX_EVENT_PAYLOAD_BYTES,
    `raw webhook body exceeds ${MAX_EVENT_PAYLOAD_BYTES} bytes`
  );
  const normalizedHeaders = headerMap(headers);
  const signature = normalizedHeaders['x-hub-signature-256'];
  assert(
    verifyWebhookSignature(rawBody, secret, signature),
    'webhook signature verification failed'
  );

  const anchors = validateTrust(trust);
  const deliveryId = normalizedHeaders['x-github-delivery'];
  assert(DELIVERY_ID.test(deliveryId ?? ''), 'X-GitHub-Delivery must be a GUID');
  const event = normalizedHeaders['x-github-event'];
  assert(
    event === 'pull_request',
    `event ${event ?? '<missing>'} does not match a pull_request payload`
  );
  const hookId = integer(normalizedHeaders['x-github-hook-id'], 'webhook hook id');
  assert(anchors.hookIds.includes(hookId), `webhook hook id ${hookId} is not trusted`);
  const targetType = normalizedHeaders['x-github-hook-installation-target-type'];
  assert(targetType === 'repository', 'webhook target type must be repository');
  const targetId = integer(
    normalizedHeaders['x-github-hook-installation-target-id'],
    'webhook target id'
  );
  assert(
    targetId === anchors.repositoryId,
    'webhook target repository does not match trust anchors'
  );
  assert(
    normalizedHeaders['user-agent']?.startsWith('GitHub-Hookshot/'),
    'webhook user agent is not GitHub-Hookshot'
  );

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (error) {
    throw new Error(`authenticated webhook payload is invalid JSON: ${error.message}`);
  }
  assert(isObject(payload), 'authenticated webhook payload must be an object');
  assert(
    typeof payload.action === 'string' && payload.action.length > 0,
    'payload action is required'
  );
  assert(isObject(payload.repository), 'payload repository is required');
  const repositoryId = integer(payload.repository.id, 'payload repository id');
  assert(
    repositoryId === anchors.repositoryId,
    'payload repository id does not match trust anchors'
  );
  assert(
    payload.repository.full_name === anchors.repositoryFullName,
    'payload repository name does not match trust anchors'
  );
  assert(isObject(payload.installation), 'payload installation is required');
  const installationId = integer(payload.installation.id, 'payload installation id');
  assert(
    anchors.installationIds.includes(installationId),
    `payload installation id ${installationId} is not trusted`
  );
  assert(isObject(payload.sender), 'payload sender is required');
  const senderId = integer(payload.sender.id, 'payload sender id');
  assert(
    typeof payload.sender.login === 'string' && payload.sender.login.length > 0,
    'sender login is required'
  );
  assert(
    typeof payload.sender.type === 'string' && payload.sender.type.length > 0,
    'sender type is required'
  );
  assert(isObject(payload.pull_request), 'event pull_request does not match payload object');

  const pullRequest = payload.pull_request;
  const number = integer(payload.number ?? pullRequest.number, 'pull request number');
  assert(
    pullRequest.number === undefined ||
      integer(pullRequest.number, 'pull request object number') === number,
    'pull request number is inconsistent'
  );
  const objectId = integer(pullRequest.id, 'pull request id');
  assert(
    typeof pullRequest.node_id === 'string' && pullRequest.node_id.length > 0,
    'pull request node id is required'
  );
  assert(isObject(pullRequest.base), 'pull request base is required');
  assert(isObject(pullRequest.head), 'pull request head is required');
  assert(SHA.test(pullRequest.base.sha ?? ''), 'pull request base SHA is invalid');
  assert(SHA.test(pullRequest.head.sha ?? ''), 'pull request head SHA is invalid');
  const updatedAt = dateTime(pullRequest.updated_at, 'pull request updated_at');

  const headRepository = isObject(pullRequest.head.repo) ? pullRequest.head.repo : null;
  let source;
  if (headRepository) {
    const headRepositoryId = integer(headRepository.id, 'head repository id');
    assert(
      typeof headRepository.full_name === 'string' && headRepository.full_name.length > 0,
      'head repository name is required'
    );
    source = {
      repositoryId: headRepositoryId,
      repositoryFullName: headRepository.full_name,
      isFork: headRepositoryId !== repositoryId,
      completeness: 'complete',
    };
  } else {
    source = {
      repositoryId: null,
      repositoryFullName: null,
      isFork: null,
      completeness: 'missing-head-repository',
    };
  }

  const key = digest(`github-webhook\0${hookId}\0${deliveryId.toLowerCase()}`);
  return {
    schemaVersion: 1,
    kind: 'proto-ui.agent-event-envelope',
    eventShadowVersion: EVENT_SHADOW_VERSION,
    mode: 'event-shadow',
    authenticated: true,
    observedAt: dateTime(observedAt, 'webhook observedAt'),
    repository: {
      id: repositoryId,
      nodeId: payload.repository.node_id ?? null,
      fullName: payload.repository.full_name,
    },
    hook: {
      id: hookId,
      targetType,
      targetId,
      installationId,
    },
    delivery: {
      id: deliveryId.toLowerCase(),
      key,
      event,
      action: payload.action,
      payloadDigest: digest(rawBody),
    },
    sender: {
      id: senderId,
      login: payload.sender.login,
      type: payload.sender.type,
    },
    object: {
      kind: 'pull-request',
      id: objectId,
      nodeId: pullRequest.node_id,
      number,
    },
    revision: {
      baseSha: pullRequest.base.sha,
      headSha: pullRequest.head.sha,
      updatedAt,
    },
    source,
    untrustedContentIncluded: false,
    mutationAuthorized: false,
    writeOperationsPerformed: 0,
  };
}

export function validateEventEnvelope(envelope) {
  const issues = [];
  exactKeys(
    envelope,
    [
      'schemaVersion',
      'kind',
      'eventShadowVersion',
      'mode',
      'authenticated',
      'observedAt',
      'repository',
      'hook',
      'delivery',
      'sender',
      'object',
      'revision',
      'source',
      'untrustedContentIncluded',
      'mutationAuthorized',
      'writeOperationsPerformed',
    ],
    'event envelope',
    issues
  );
  if (!isObject(envelope)) return issues;
  if (envelope.schemaVersion !== 1) issues.push('schemaVersion must be 1');
  if (envelope.kind !== 'proto-ui.agent-event-envelope') issues.push('kind is invalid');
  if (envelope.eventShadowVersion !== EVENT_SHADOW_VERSION) issues.push('version is invalid');
  if (envelope.mode !== 'event-shadow') issues.push('mode must be event-shadow');
  if (envelope.authenticated !== true) issues.push('authenticated must be true');
  if (!isCanonicalDateTime(envelope.observedAt)) issues.push('observedAt is invalid');
  exactKeys(envelope.repository, ['id', 'nodeId', 'fullName'], 'repository', issues);
  exactKeys(envelope.hook, ['id', 'targetType', 'targetId', 'installationId'], 'hook', issues);
  exactKeys(
    envelope.delivery,
    ['id', 'key', 'event', 'action', 'payloadDigest'],
    'delivery',
    issues
  );
  exactKeys(envelope.sender, ['id', 'login', 'type'], 'sender', issues);
  exactKeys(envelope.object, ['kind', 'id', 'nodeId', 'number'], 'object', issues);
  exactKeys(envelope.revision, ['baseSha', 'headSha', 'updatedAt'], 'revision', issues);
  exactKeys(
    envelope.source,
    ['repositoryId', 'repositoryFullName', 'isFork', 'completeness'],
    'source',
    issues
  );
  if (!isPositiveInteger(envelope.repository?.id)) issues.push('repository id is invalid');
  if (!(envelope.repository?.nodeId === null || typeof envelope.repository?.nodeId === 'string')) {
    issues.push('repository nodeId is invalid');
  }
  if (!isRepositoryFullName(envelope.repository?.fullName)) {
    issues.push('repository fullName is invalid');
  }
  if (!isPositiveInteger(envelope.hook?.id)) issues.push('hook id is invalid');
  if (!isPositiveInteger(envelope.hook?.targetId)) issues.push('hook target id is invalid');
  if (!isPositiveInteger(envelope.hook?.installationId)) {
    issues.push('hook installation id is invalid');
  }
  if (!DELIVERY_ID.test(envelope.delivery?.id ?? '')) issues.push('delivery id is invalid');
  if (!DIGEST.test(envelope.delivery?.key ?? '')) issues.push('delivery key is invalid');
  if (!DIGEST.test(envelope.delivery?.payloadDigest ?? ''))
    issues.push('payload digest is invalid');
  if (
    isPositiveInteger(envelope.hook?.id) &&
    DELIVERY_ID.test(envelope.delivery?.id ?? '') &&
    envelope.delivery?.key !==
      digest(`github-webhook\0${envelope.hook.id}\0${envelope.delivery.id.toLowerCase()}`)
  ) {
    issues.push('delivery key does not bind hook and delivery identity');
  }
  if (
    typeof envelope.delivery?.action !== 'string' ||
    envelope.delivery.action.length < 1 ||
    envelope.delivery.action.length > 80
  ) {
    issues.push('delivery action is invalid');
  }
  if (!isPositiveInteger(envelope.sender?.id)) issues.push('sender id is invalid');
  if (
    typeof envelope.sender?.login !== 'string' ||
    envelope.sender.login.length < 1 ||
    envelope.sender.login.length > 100
  ) {
    issues.push('sender login is invalid');
  }
  if (
    typeof envelope.sender?.type !== 'string' ||
    envelope.sender.type.length < 1 ||
    envelope.sender.type.length > 40
  ) {
    issues.push('sender type is invalid');
  }
  if (!isPositiveInteger(envelope.object?.id)) issues.push('object id is invalid');
  if (!isPositiveInteger(envelope.object?.number)) issues.push('object number is invalid');
  if (typeof envelope.object?.nodeId !== 'string' || envelope.object.nodeId.length < 1) {
    issues.push('object nodeId is invalid');
  }
  if (!SHA.test(envelope.revision?.baseSha ?? '')) issues.push('base SHA is invalid');
  if (!SHA.test(envelope.revision?.headSha ?? '')) issues.push('head SHA is invalid');
  if (!isCanonicalDateTime(envelope.revision?.updatedAt)) {
    issues.push('revision updatedAt is invalid');
  }
  if (envelope.repository?.id !== envelope.hook?.targetId) {
    issues.push('hook target id must match repository id');
  }
  if (envelope.hook?.targetType !== 'repository') issues.push('hook targetType is invalid');
  if (envelope.delivery?.event !== 'pull_request') issues.push('delivery event is invalid');
  if (envelope.object?.kind !== 'pull-request') issues.push('object kind is invalid');
  if (envelope.source?.completeness === 'complete') {
    if (
      !Number.isSafeInteger(envelope.source.repositoryId) ||
      envelope.source.repositoryId < 1 ||
      !isRepositoryFullName(envelope.source.repositoryFullName) ||
      typeof envelope.source.isFork !== 'boolean'
    ) {
      issues.push('complete source must contain repository identity and fork status');
    }
  } else if (envelope.source?.completeness === 'missing-head-repository') {
    if (
      envelope.source.repositoryId !== null ||
      envelope.source.repositoryFullName !== null ||
      envelope.source.isFork !== null
    ) {
      issues.push('missing source must use null repository identity and fork status');
    }
  } else {
    issues.push('source completeness is invalid');
  }
  if (envelope.untrustedContentIncluded !== false) {
    issues.push('untrustedContentIncluded must be false');
  }
  if (envelope.mutationAuthorized !== false) issues.push('mutationAuthorized must be false');
  if (envelope.writeOperationsPerformed !== 0) {
    issues.push('writeOperationsPerformed must be zero');
  }
  return issues;
}

function validateState(state) {
  assert(isObject(state), 'event shadow state must be an object');
  const topKeys = Object.keys(state).sort();
  assert(
    topKeys.join('\0') ===
      ['kind', 'objectCursors', 'schemaVersion', 'seenDeliveryKeys'].sort().join('\0'),
    'event shadow state has unknown or missing fields'
  );
  assert(state.schemaVersion === 1, 'event shadow state schemaVersion must be 1');
  assert(state.kind === 'proto-ui.event-shadow-state', 'event shadow state kind is invalid');
  assert(Array.isArray(state.seenDeliveryKeys), 'seenDeliveryKeys must be an array');
  assert(
    state.seenDeliveryKeys.length <= MAX_EVENT_STATE_ENTRIES,
    `seenDeliveryKeys exceeds ${MAX_EVENT_STATE_ENTRIES} entries`
  );
  assert(
    state.seenDeliveryKeys.every((value) => DIGEST.test(value)),
    'seen delivery key is invalid'
  );
  assert(
    new Set(state.seenDeliveryKeys).size === state.seenDeliveryKeys.length,
    'seen delivery keys are duplicated'
  );
  assert(
    state.seenDeliveryKeys.every(
      (value, index, values) => index === 0 || values[index - 1] < value
    ),
    'seen delivery keys must be sorted'
  );
  assert(isObject(state.objectCursors), 'objectCursors must be an object');
  assert(
    Object.keys(state.objectCursors).length <= MAX_EVENT_STATE_ENTRIES,
    `objectCursors exceeds ${MAX_EVENT_STATE_ENTRIES} entries`
  );
  for (const [key, cursor] of Object.entries(state.objectCursors)) {
    assert(OBJECT_KEY.test(key), `object cursor key is invalid: ${key}`);
    assert(isObject(cursor), `object cursor ${key} must be an object`);
    assert(
      Object.keys(cursor).sort().join('\0') ===
        ['deliveryKey', 'headSha', 'updatedAt'].sort().join('\0'),
      `object cursor ${key} has unknown or missing fields`
    );
    assert(DIGEST.test(cursor.deliveryKey ?? ''), `object cursor ${key} deliveryKey is invalid`);
    assert(SHA.test(cursor.headSha ?? ''), `object cursor ${key} headSha is invalid`);
    assert(isCanonicalDateTime(cursor.updatedAt), `object cursor ${key} updatedAt is invalid`);
    assert(
      state.seenDeliveryKeys.includes(cursor.deliveryKey),
      `object cursor ${key} does not reference a consumed delivery`
    );
  }
}

function validatePolicy(policy) {
  assert(isObject(policy), 'event shadow policy is required');
  assert(policy.policyVersion === EVENT_SHADOW_VERSION, 'event shadow policy version is invalid');
  assert(isObject(policy.allowlist), 'event shadow allowlist is required');
  for (const [event, actions] of Object.entries(policy.allowlist)) {
    assert(typeof event === 'string' && event.length > 0, 'allowlisted event is invalid');
    assert(Array.isArray(actions) && actions.length > 0, `allowlist for ${event} is empty`);
    assert(
      actions.every((action) => typeof action === 'string' && action.length > 0),
      `allowlist for ${event} is invalid`
    );
  }
  assert(Array.isArray(policy.selfActorIds), 'selfActorIds must be an array');
  assert(
    policy.selfActorIds.length > 0 && policy.selfActorIds.every(isPositiveInteger),
    'self actor id is invalid'
  );
  assert(
    new Set(policy.selfActorIds).size === policy.selfActorIds.length,
    'self actor ids are duplicated'
  );
}

function makeReceipt(envelope, outcome, reason, nextStage, requiresLiveRevalidation) {
  return {
    schemaVersion: 1,
    kind: 'proto-ui.event-shadow-receipt',
    policyVersion: EVENT_SHADOW_VERSION,
    envelopeDigest: digest(envelope),
    deliveryKey: envelope.delivery.key,
    objectKey: objectKeyForEnvelope(envelope),
    outcome,
    reason,
    nextStage,
    requiresLiveRevalidation,
    mutationAuthorized: false,
    writeOperationsPerformed: 0,
  };
}

export function validateEventShadowReceipt(receipt) {
  const issues = [];
  exactKeys(
    receipt,
    [
      'schemaVersion',
      'kind',
      'policyVersion',
      'envelopeDigest',
      'deliveryKey',
      'objectKey',
      'outcome',
      'reason',
      'nextStage',
      'requiresLiveRevalidation',
      'mutationAuthorized',
      'writeOperationsPerformed',
    ],
    'event shadow receipt',
    issues
  );
  if (!isObject(receipt)) return issues;
  if (receipt.schemaVersion !== 1) issues.push('schemaVersion must be 1');
  if (receipt.kind !== 'proto-ui.event-shadow-receipt') issues.push('kind is invalid');
  if (receipt.policyVersion !== EVENT_SHADOW_VERSION) issues.push('policyVersion is invalid');
  if (!DIGEST.test(receipt.envelopeDigest ?? '')) issues.push('envelopeDigest is invalid');
  if (!DIGEST.test(receipt.deliveryKey ?? '')) issues.push('deliveryKey is invalid');
  if (!OBJECT_KEY.test(receipt.objectKey ?? '')) {
    issues.push('objectKey is invalid');
  }
  if (!OUTCOMES.has(receipt.outcome)) issues.push('outcome is invalid');
  if (
    typeof receipt.reason !== 'string' ||
    receipt.reason.length < 1 ||
    receipt.reason.length > 200
  ) {
    issues.push('reason is invalid');
  }
  if (!['none', 'collect-live-state', 'reconcile-live-state'].includes(receipt.nextStage)) {
    issues.push('nextStage is invalid');
  }
  if (typeof receipt.requiresLiveRevalidation !== 'boolean') {
    issues.push('requiresLiveRevalidation must be boolean');
  }
  if (receipt.mutationAuthorized !== false) issues.push('mutationAuthorized must be false');
  if (receipt.writeOperationsPerformed !== 0) {
    issues.push('writeOperationsPerformed must be zero');
  }
  const outcomeBoundary = {
    ADMITTED: ['collect-live-state', true],
    DUPLICATE: ['none', false],
    UNSUPPORTED: ['none', false],
    SELF_ECHO: ['none', false],
    OUT_OF_ORDER: ['reconcile-live-state', true],
    AMBIGUOUS_ORDER: ['reconcile-live-state', true],
  }[receipt.outcome];
  if (
    outcomeBoundary &&
    (receipt.nextStage !== outcomeBoundary[0] ||
      receipt.requiresLiveRevalidation !== outcomeBoundary[1])
  ) {
    issues.push('outcome, nextStage, and live-revalidation boundary are inconsistent');
  }
  return issues;
}

export function validateEventShadowBinding(envelope, receipt) {
  const issues = [...validateEventEnvelope(envelope), ...validateEventShadowReceipt(receipt)];
  if (!isObject(envelope) || !isObject(receipt)) return issues;
  if (receipt.envelopeDigest !== digest(envelope)) {
    issues.push('receipt envelopeDigest does not bind the event envelope');
  }
  if (receipt.deliveryKey !== envelope.delivery?.key) {
    issues.push('receipt deliveryKey does not bind the event envelope');
  }
  if (receipt.objectKey !== objectKeyForEnvelope(envelope)) {
    issues.push('receipt objectKey does not bind the event envelope');
  }
  return issues;
}

export function evaluateEventShadow({ envelope, policy, state }) {
  const envelopeIssues = validateEventEnvelope(envelope);
  assert(envelopeIssues.length === 0, `event envelope is invalid: ${envelopeIssues.join('; ')}`);
  validatePolicy(policy);
  validateState(state);

  const objectKey = objectKeyForEnvelope(envelope);
  const deliveryKey = envelope.delivery.key;
  if (state.seenDeliveryKeys.includes(deliveryKey)) {
    return {
      receipt: makeReceipt(envelope, 'DUPLICATE', 'delivery-key-already-consumed', 'none', false),
      nextState: structuredClone(state),
    };
  }
  assert(
    state.seenDeliveryKeys.length < MAX_EVENT_STATE_ENTRIES,
    'event shadow state capacity is exhausted; reconcile or rotate state before admitting work'
  );

  const nextState = structuredClone(state);
  nextState.seenDeliveryKeys = [...nextState.seenDeliveryKeys, deliveryKey].sort();
  const actions = policy.allowlist[envelope.delivery.event];
  if (!actions?.includes(envelope.delivery.action)) {
    return {
      receipt: makeReceipt(
        envelope,
        'UNSUPPORTED',
        'event-or-action-not-allowlisted',
        'none',
        false
      ),
      nextState,
    };
  }
  if (policy.selfActorIds.includes(envelope.sender.id)) {
    return {
      receipt: makeReceipt(
        envelope,
        'SELF_ECHO',
        'sender-is-dedicated-agent-identity',
        'none',
        false
      ),
      nextState,
    };
  }

  const cursor = nextState.objectCursors[objectKey];
  if (!cursor) {
    assert(
      Object.keys(nextState.objectCursors).length < MAX_EVENT_STATE_ENTRIES,
      'object cursor state capacity is exhausted; reconcile or rotate state before admitting work'
    );
  }
  if (cursor) {
    const incoming = Date.parse(envelope.revision.updatedAt);
    const current = Date.parse(cursor.updatedAt);
    if (incoming < current) {
      return {
        receipt: makeReceipt(
          envelope,
          'OUT_OF_ORDER',
          'object-revision-precedes-current-cursor',
          'reconcile-live-state',
          true
        ),
        nextState,
      };
    }
    if (incoming === current) {
      return {
        receipt: makeReceipt(
          envelope,
          'AMBIGUOUS_ORDER',
          'object-revision-does-not-establish-a-total-order',
          'reconcile-live-state',
          true
        ),
        nextState,
      };
    }
  }

  nextState.objectCursors[objectKey] = {
    deliveryKey,
    updatedAt: envelope.revision.updatedAt,
    headSha: envelope.revision.headSha,
  };
  return {
    receipt: makeReceipt(
      envelope,
      'ADMITTED',
      'authenticated-allowlisted-newer-delivery',
      'collect-live-state',
      true
    ),
    nextState,
  };
}
