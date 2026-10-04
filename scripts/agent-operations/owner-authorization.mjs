import fs from 'node:fs';
import { createPublicKey, verify } from 'node:crypto';
const proofs = new WeakMap();
const actions = new Set(['observe', 'implement', 'collaborate', 'review', 'integrate']);
const sources = new Set([
  'current-user',
  'active-human-loop',
  'maintainer-invocation',
  'schedule',
  'governed-queue',
]);
const ordinaryMutations = new Set([
  'none',
  'proposal-only',
  'feature-branch',
  'disposable-output-only',
  'reversible-github-metadata',
  'reversible-github-collaboration',
  'conditional-pull-request-merge',
  'tracked-maintenance-state',
]);
function fail(ok, message) {
  if (!ok) throw Error('owner delegation: ' + message);
}
export function ownerDelegationSigningBytes(payload) {
  const canonical = (value) =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === 'object'
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((k) => [k, canonical(value[k])])
          )
        : value;
  return Buffer.from(JSON.stringify(canonical(payload)));
}
function readGrant(statePath, key, grantId) {
  const document = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  fail(
    Object.keys(document).sort().join(',') === 'payload,signature',
    'invalid signed state shape'
  );
  fail(
    typeof document.signature === 'string' && /^[A-Za-z0-9+/]{86}==$/.test(document.signature),
    'invalid signature encoding'
  );
  fail(
    verify(
      null,
      ownerDelegationSigningBytes(document.payload),
      key,
      Buffer.from(document.signature, 'base64')
    ),
    'signature is not trusted'
  );
  const state = document.payload;
  fail(
    state?.schemaVersion === 1 &&
      state.kind === 'proto-ui.owner-delegation-state' &&
      Number.isSafeInteger(state.revision) &&
      state.revision > 0 &&
      Array.isArray(state.grants),
    'invalid signed state'
  );
  fail(new Set(state.grants.map((g) => g.id)).size === state.grants.length, 'duplicate grant IDs');
  const grant = state.grants.find((g) => g.id === grantId);
  fail(grant?.status === 'active', 'grant is absent or revoked');
  fail(
    grant.grantor?.login === 'cyjin-yl' && grant.grantor.id === 19223209,
    'grantor differs from the delegated owner'
  );
  fail(grant.actor === 'cyjin-yl', 'credential actor differs from the delegated owner');
  fail(
    grant.repositoryId === 'github.com:Proto-UI/Proto-UI',
    'repository is outside owner delegation'
  );
  fail(
    Array.isArray(grant.actions) &&
      grant.actions.length > 0 &&
      grant.actions.every((a) => actions.has(a)) &&
      new Set(grant.actions).size === grant.actions.length,
    'unsupported or privileged action'
  );
  fail(
    Array.isArray(grant.scopeIds) &&
      grant.scopeIds.length > 0 &&
      grant.scopeIds.every((s) => typeof s === 'string' && s.length > 0 && s.length <= 120) &&
      new Set(grant.scopeIds).size === grant.scopeIds.length,
    'invalid scopes'
  );
  fail(grant.baseRefName === 'main', 'unsupported integration base');
  fail(
    typeof grant.decisionReference === 'string' &&
      grant.decisionReference.length > 0 &&
      grant.decisionReference.length <= 1000,
    'trusted owner decision reference is missing'
  );
  return { grant, revision: state.revision };
}
// The key and state locations come ONLY from the trusted launcher, never a handoff or Issue.
// The proof cannot be forged by supplying a JSON object; every admission re-reads signed state.
export function loadOwnerAuthorization({ statePath, publicKeyPath, grantId }) {
  fail(
    typeof statePath === 'string' &&
      typeof publicKeyPath === 'string' &&
      typeof grantId === 'string',
    'all launcher arguments are required'
  );
  const key = createPublicKey(fs.readFileSync(publicKeyPath));
  fail(key.asymmetricKeyType === 'ed25519', 'only an Ed25519 trust anchor is accepted');
  const initial = readGrant(statePath, key, grantId);
  const proof = Object.freeze({
    id: initial.grant.id,
    repositoryId: initial.grant.repositoryId,
    actor: initial.grant.actor,
  });
  proofs.set(proof, { statePath, key, grantId, initial });
  return proof;
}
export function ownerAuthorizationFromArgs(args) {
  const statePath = args.get('--owner-authorization'),
    publicKeyPath = args.get('--owner-key'),
    grantId = args.get('--owner-grant');
  if ([statePath, publicKeyPath, grantId].every((x) => x === undefined)) return null;
  return loadOwnerAuthorization({ statePath, publicKeyPath, grantId });
}
export function ownerAuthorizationAllows(
  proof,
  { repositoryId, scopeId, action, actor, authorizationId, executionModeSource, executionMode } = {}
) {
  const context = proofs.get(proof);
  if (!context) return false;
  try {
    const current = readGrant(context.statePath, context.key, context.grantId);
    if (current.revision < context.initial.revision) return false;
    const grant = current.grant;
    // A scope/profile change requires a fresh invocation; revocation stops this one immediately.
    if (
      !ownerDelegationSigningBytes(grant).equals(ownerDelegationSigningBytes(context.initial.grant))
    )
      return false;
    return (
      sources.has(executionModeSource) &&
      (executionMode === undefined ||
        (executionMode === 'human-assisted'
          ? ['current-user', 'active-human-loop'].includes(executionModeSource)
          : executionMode === 'autonomous' &&
            ['maintainer-invocation', 'schedule', 'governed-queue'].includes(
              executionModeSource
            ))) &&
      grant.repositoryId === repositoryId &&
      grant.actions.includes(action) &&
      (grant.scopeIds.includes('*') ||
        (typeof scopeId === 'string' && grant.scopeIds.includes(scopeId))) &&
      (actor === undefined || actor.toLowerCase() === grant.actor.toLowerCase()) &&
      (authorizationId === undefined || authorizationId === grant.id)
    );
  } catch {
    return false;
  }
}
export function ownerSkillEligibility(
  skill,
  { ownerAuthorization, repositoryId, scopeId, executionModeSource, executionMode } = {}
) {
  const action =
    skill.id === 'pui-integrate'
      ? 'integrate'
      : skill.id === 'pui-review'
        ? 'review'
        : skill.mutation.startsWith('reversible-github')
          ? 'collaborate'
          : skill.mutation === 'none'
            ? 'observe'
            : 'implement';
  if (
    skill.id.startsWith('pui-release') ||
    skill.id === 'pui-evidence-publish' ||
    !ordinaryMutations.has(skill.mutation)
  )
    return null;
  return ownerAuthorizationAllows(ownerAuthorization, {
    repositoryId,
    scopeId,
    action,
    executionModeSource,
    executionMode,
  })
    ? {
        eligible: true,
        assessmentEffect: 'advisory',
        reason:
          'durable owner delegation covers this ordinary transition; live action checks still apply',
      }
    : null;
}

export function ownerCollaborationScope({ target }) {
  if (target?.kind === 'workflow-run' && Number.isSafeInteger(target.runId) && target.runId > 0)
    return 'workflow-run:' + target.runId;
  if (
    target?.kind === 'review-thread' &&
    Number.isSafeInteger(target.number) &&
    target.number > 0 &&
    typeof target.threadId === 'string' &&
    target.threadId.length > 0
  )
    return 'pull-request:' + target.number + ':review-thread:' + target.threadId;
  if (
    ['issue', 'pull-request'].includes(target?.kind) &&
    Number.isSafeInteger(target.number) &&
    target.number > 0
  )
    return target.kind + ':' + target.number;
  throw Error('owner delegation requires a stable exact target scope');
}
