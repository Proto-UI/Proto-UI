import { ownerAuthorizationFromArgs, ownerCollaborationScope } from './owner-authorization.mjs';
import fs from 'node:fs';
import {
  assertModelTraceInputsOutsideCheckout,
  loadModelTraceRecord,
  readModelTraceJson,
} from './modeltrace.mjs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import {
  collectRepositorySnapshot,
  deriveRepositoryId,
  isSelfAssessmentFresh,
  loadCapabilityPolicy,
  validateSelfAssessmentResult,
} from './assessment-runtime.mjs';
import {
  authorizeCollaborationMutation,
  buildCollaborationReceipt,
  computeCollaborationRequestDigest,
  validateCollaborationHandoffBinding,
  validateCollaborationRequest,
} from './collaboration-runtime.mjs';
import {
  applyGitHubCollaborationMutation,
  CollaborationMutationUnknown,
  CollaborationPreWriteRejection,
  collectLiveCollaborationState,
  collectLiveThreadRevisionTarget,
} from './collect-live-collaboration-state.mjs';
import {
  establishExecutionMode,
  evaluateSkillEligibility,
  loadSkillRegistry,
  skillRegistryRoot,
  validateSkillHandoff,
  requireCompletedHandoff,
} from './skill-registry.mjs';

const POLICY_PATH = new URL(
  '../../internal/agent-operations/capability-policy.yaml',
  import.meta.url
);

function usage() {
  return [
    'Usage:',
    '  pnpm agent:collaborate -- thread-revision --repository <github.com:owner/repo> --pull-request <number> --thread <thread-id>',
    '  pnpm agent:collaborate -- request-digest --request <request.json>',
    '  pnpm agent:collaborate -- validate --mode human-assisted|autonomous --mode-source <trusted-source> --request <request.json> --handoff <handoff.json> [--assessment <result.json>] [--owner-authorization <state.json> --owner-key <public.pem> --owner-grant <grant-id>]',
    '  pnpm agent:collaborate -- apply --mode human-assisted|autonomous --mode-source <trusted-source> --request <request.json> --handoff <handoff.json> --record <record.json> --context <context.json> [--assessment <result.json>] [--owner-authorization <state.json> --owner-key <public.pem> --owner-grant <grant-id>]',
    '',
    'validate and apply require mode and source declared independently by the launcher/operator, matching the handoff. These arguments are declarations, not runtime attestation.',
    'apply additionally requires --record and --context for a fresh private ModelTrace load, scope check, and exact reference/digest binding before any live GitHub dependency.',
    'apply performs a fresh live GitHub preflight, checks admission for one declared purpose-bound action, emits an idempotent no-op when already satisfied, or attempts exactly one mutation. A thrown/unknown write is reconciled once and is never retried blindly.',
  ].join('\n');
}

const OPTIONS = new Map([
  ['thread-revision', new Set(['--repository', '--pull-request', '--thread'])],
  ['request-digest', new Set(['--request'])],
  [
    'validate',
    new Set([
      '--mode',
      '--mode-source',
      '--request',
      '--handoff',
      '--assessment',
      '--record',
      '--context',
      '--owner-authorization',
      '--owner-key',
      '--owner-grant',
    ]),
  ],
  [
    'apply',
    new Set([
      '--mode',
      '--mode-source',
      '--request',
      '--handoff',
      '--assessment',
      '--record',
      '--context',
      '--owner-authorization',
      '--owner-key',
      '--owner-grant',
    ]),
  ],
]);

export function parseCollaborationCli(argv) {
  argv = [...argv];
  if (argv[0] === '--') argv.shift();
  const command = argv.shift();
  if (!OPTIONS.has(command) || argv.length % 2 !== 0) throw new Error(usage());
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!OPTIONS.get(command).has(name)) {
      throw new Error(`unexpected option for ${command}: ${name}\n${usage()}`);
    }
    if (value === undefined || args.has(name)) throw new Error(usage());
    args.set(name, value);
  }
  return { command, args };
}

function readJson(path, option) {
  if (!path) throw new Error(`${option} is required`);
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function readRequest(path) {
  return validateCollaborationRequest(readJson(path, '--request'));
}

function loadAssessment(path, policy, request) {
  if (!path) return null;
  const result = readJson(path, '--assessment');
  validateSelfAssessmentResult(result, policy);
  // Bind the assessment to this checkout and to the exact request target: a
  // capability envelope issued for another repository cannot authorize a
  // mutation here.
  const checkedOutRepositoryId = deriveRepositoryId(skillRegistryRoot);
  if (result.scope.repositoryId !== checkedOutRepositoryId) {
    throw new Error('assessment scope repository does not match the checked-out repository');
  }
  if (request && result.scope.repositoryId !== request.repositoryId) {
    throw new Error('assessment scope repository does not match the exact collaboration target');
  }
  const snapshot = collectRepositorySnapshot(skillRegistryRoot, {
    repositoryId: checkedOutRepositoryId,
  });
  return { ...result, validated: true, fresh: isSelfAssessmentFresh(result, snapshot) };
}

function loadInvocationContext(args, command) {
  const executionMode = args.get('--mode');
  const executionModeSource = args.get('--mode-source');
  if (!executionMode) throw new Error('--mode is required for validate and apply');
  if (!executionModeSource) throw new Error('--mode-source is required for validate and apply');
  establishExecutionMode(executionMode, executionModeSource);
  if (command === 'apply') {
    assertModelTraceInputsOutsideCheckout({
      recordPath: args.get('--record'),
      contextPath: args.get('--context'),
      checkoutRoot: skillRegistryRoot,
    });
  }
  // Preserve the independent operator declaration before reading task-authored
  // artifacts. This binding cannot authenticate a caller that controls both.
  return Object.freeze({
    executionMode,
    executionModeSource,
    ownerAuthorization: ownerAuthorizationFromArgs(args),
  });
}

function loadCollaborationHandoff(path, invocationContext) {
  const handoff = readJson(path, '--handoff');
  for (const field of ['executionMode', 'executionModeSource']) {
    if (handoff?.[field] !== invocationContext[field]) {
      throw new Error(`handoff ${field} does not match the independent invocation declaration`);
    }
  }
  requireCompletedHandoff(handoff);
  const routed = validateSkillHandoff(handoff, loadSkillRegistry());
  if (routed.nextSkill?.id !== 'pui-collaborate') {
    throw new Error('handoff must select pui-collaborate');
  }
  if (routed.handoff.humanGates.length > 0) {
    throw new Error('pui-collaborate cannot run while an attended decision is pending');
  }
  return routed;
}

function validateExecution(request, args, policy, invocationContext, routed) {
  const selfAssessment = loadAssessment(args.get('--assessment'), policy, request);
  validateCollaborationHandoffBinding(request, routed.handoff, {
    selfAssessment,
    ownerAuthorization: invocationContext.ownerAuthorization,
  });
  const eligibility = evaluateSkillEligibility(routed.nextSkill, {
    executionMode: invocationContext.executionMode,
    selfAssessment,
    entrypoint: routed.handoff.entrypoint,
    ownerAuthorization: invocationContext.ownerAuthorization,
    executionModeSource: invocationContext.executionModeSource,
    repositoryId: request.repositoryId,
    scopeId: ownerCollaborationScope(request),
  });
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  if (
    invocationContext.executionMode === 'autonomous' &&
    request.authorizationId === 'explicit-current-user'
  ) {
    throw new Error('autonomous collaboration cannot claim current-user authorization');
  }
  return { selfAssessment, eligibility };
}

function rejectedReceipt(request, preState, postState, reason, modelTrace) {
  return buildCollaborationReceipt({
    request,
    preState,
    postState,
    actor: postState.viewerLogin,
    outcome: 'rejected',
    mutationCount: 0,
    reconciliationCount: 0,
    platformObject: null,
    verifiedAt: postState.observedAt,
    verification: 'live-authorization-rejected',
    note: reason,
    modelTrace,
  });
}

export function runCollaborationCli(argv, dependencies = {}) {
  const { command, args } = parseCollaborationCli(argv);
  if (command === 'thread-revision') {
    const number = args.get('--pull-request');
    if (!/^[1-9]\d*$/.test(number ?? ''))
      throw new Error('--pull-request must be a positive integer');
    return collectLiveThreadRevisionTarget(
      {
        repositoryId: args.get('--repository'),
        number: Number(number),
        threadId: args.get('--thread'),
      },
      { runner: dependencies.runner, now: dependencies.now }
    );
  }
  if (command === 'request-digest') {
    const draft = readJson(args.get('--request'), '--request');
    const request = {
      ...draft,
      requestDigest: computeCollaborationRequestDigest(draft),
    };
    validateCollaborationRequest(request);
    return { valid: true, requestDigest: request.requestDigest };
  }

  const invocationContext = loadInvocationContext(args, command);
  // Reject missing, invalid, or conflicting declarations before assessment
  // collection, live GitHub reads, or any other external dependency is called.
  const routed = loadCollaborationHandoff(args.get('--handoff'), invocationContext);
  const request = readRequest(args.get('--request'));
  const policy = (dependencies.loadPolicy ?? loadCapabilityPolicy)(POLICY_PATH);
  const execution = validateExecution(request, args, policy, invocationContext, routed);
  if (command === 'validate') {
    return {
      valid: true,
      requestDigest: request.requestDigest,
      action: request.action,
      ...invocationContext,
      eligibility: execution.eligibility,
    };
  }

  const modelTrace = loadModelTraceRecord({
    recordPath: args.get('--record'),
    contextPath: args.get('--context'),
    repositoryId: request.repositoryId,
  });
  const modelTraceContext = readModelTraceJson(args.get('--context'), 'context');
  const recordArtifact = routed.handoff.artifacts.find((item) => item.type === 'modeltrace-record');
  const requestRecord = request.evidence.find((item) => item.type === 'modeltrace-record');
  if (
    recordArtifact?.reference !== args.get('--record') ||
    recordArtifact.digest !== modelTrace.id ||
    requestRecord?.reference !== args.get('--record') ||
    requestRecord.digest !== modelTrace.id
  )
    throw new Error(
      'request and handoff must bind the --record reference and measured receipt digest'
    );

  const collectState = dependencies.collectState ?? collectLiveCollaborationState;
  const preState = collectState(request, { runner: dependencies.runner });
  const decision = authorizeCollaborationMutation({
    request,
    liveState: preState,
    ...invocationContext,
    policy,
    selfAssessment: execution.selfAssessment,
    modelTrace,
    modelTraceContext,
  });
  if (!decision.allowed)
    return rejectedReceipt(request, preState, preState, decision.reason, modelTrace);

  if (decision.outcome === 'no-op') {
    return buildCollaborationReceipt({
      request,
      preState,
      postState: preState,
      actor: preState.viewerLogin,
      outcome: 'no-op',
      mutationCount: 0,
      reconciliationCount: 0,
      platformObject: null,
      verifiedAt: preState.observedAt,
      verification:
        request.action === 'post-bounded-reconciliation-comment'
          ? 'idempotency-marker-present'
          : 'live-state-matches-desired',
      note: decision.reason,
      modelTrace,
    });
  }

  const applyMutation = dependencies.applyMutation ?? applyGitHubCollaborationMutation;
  let applied;
  try {
    applied = applyMutation(request, preState, {
      collectState,
      runner: dependencies.runner,
      authorizationContext: {
        ...invocationContext,
        policy,
        selfAssessment: execution.selfAssessment,
        modelTrace,
        modelTraceContext,
      },
    });
  } catch (error) {
    if (!(error instanceof CollaborationPreWriteRejection)) throw error;
    return rejectedReceipt(request, preState, error.liveState, error.message, modelTrace);
  }
  try {
    return buildCollaborationReceipt({
      request,
      preState,
      postState: applied.postState,
      actor: preState.viewerLogin,
      outcome: applied.mutationCount === 0 ? 'no-op' : 'applied',
      mutationCount: applied.mutationCount,
      reconciliationCount: applied.reconciliationCount,
      platformObject: applied.platformObject,
      verifiedAt: applied.postState.observedAt,
      verification:
        request.action === 'post-bounded-reconciliation-comment'
          ? 'idempotency-marker-present'
          : 'live-state-matches-desired',
      note:
        applied.mutationCount === 0
          ? 'The exact desired state was already satisfied at the final admission read; no mutation was attempted.'
          : 'The exact desired state was verified after the single admitted mutation.',
      modelTrace,
    });
  } catch (error) {
    if (request.action !== 'post-bounded-reconciliation-comment' || applied.mutationCount !== 1)
      throw error;
    throw new CollaborationMutationUnknown(
      request,
      preState.viewerLogin,
      applied.rawResponse !== null && applied.rawResponse !== undefined,
      'comment-post-receipt-unavailable'
    );
  }
}

export function executeCollaborationCli(argv, dependencies = {}, io = process) {
  try {
    const output = runCollaborationCli(argv, dependencies);
    io.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return 0;
  } catch (error) {
    if (error instanceof CollaborationMutationUnknown)
      io.stdout.write(`${JSON.stringify(error.result, null, 2)}\n`);
    io.stderr.write(`[agent:collaborate] ${error.message}\n`);
    return 1;
  }
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) process.exitCode = executeCollaborationCli(process.argv.slice(2));
