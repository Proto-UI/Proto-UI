import fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import {
  collectRepositorySnapshot,
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
  collectLiveCollaborationState,
} from './collect-live-collaboration-state.mjs';
import {
  evaluateSkillEligibility,
  loadSkillRegistry,
  skillRegistryRoot,
  validateSkillHandoff,
} from './skill-registry.mjs';

const POLICY_PATH = new URL(
  '../../internal/agent-operations/capability-policy.yaml',
  import.meta.url
);

function usage() {
  return [
    'Usage:',
    '  pnpm agent:collaborate -- request-digest --request <request.json>',
    '  pnpm agent:collaborate -- validate --request <request.json> --handoff <handoff.json> [--assessment <result.json>]',
    '  pnpm agent:collaborate -- apply --request <request.json> --handoff <handoff.json> [--assessment <result.json>]',
    '',
    'apply performs a fresh live GitHub preflight, authorizes one purpose-bound action, emits an idempotent no-op when already satisfied, or attempts exactly one mutation. A thrown/unknown write is reconciled once and is never retried blindly.',
  ].join('\n');
}

const OPTIONS = new Map([
  ['request-digest', new Set(['--request'])],
  ['validate', new Set(['--request', '--handoff', '--assessment'])],
  ['apply', new Set(['--request', '--handoff', '--assessment'])],
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

function loadAssessment(path, policy) {
  if (!path) return null;
  const result = readJson(path, '--assessment');
  validateSelfAssessmentResult(result, policy);
  const snapshot = collectRepositorySnapshot(skillRegistryRoot, {
    repositoryId: result.scope.repositoryId,
  });
  return { ...result, validated: true, fresh: isSelfAssessmentFresh(result, snapshot) };
}

function loadCollaborationHandoff(path) {
  const handoff = readJson(path, '--handoff');
  const routed = validateSkillHandoff(handoff, loadSkillRegistry());
  if (routed.nextSkill?.id !== 'pui-collaborate') {
    throw new Error('handoff must select pui-collaborate');
  }
  if (routed.handoff.humanGates.length > 0) {
    throw new Error('pui-collaborate cannot run while an attended decision is pending');
  }
  return routed;
}

function validateExecution(request, args, policy) {
  const routed = loadCollaborationHandoff(args.get('--handoff'));
  const selfAssessment = loadAssessment(args.get('--assessment'), policy);
  validateCollaborationHandoffBinding(request, routed.handoff, { selfAssessment });
  const eligibility = evaluateSkillEligibility(routed.nextSkill, {
    executionMode: routed.handoff.executionMode,
    selfAssessment,
  });
  if (!eligibility.eligible) throw new Error(eligibility.reason);
  if (
    routed.handoff.executionMode === 'autonomous' &&
    request.authorizationId === 'explicit-current-user'
  ) {
    throw new Error('autonomous collaboration cannot claim current-user authorization');
  }
  return { handoff: routed.handoff, selfAssessment, eligibility };
}

export function runCollaborationCli(argv, dependencies = {}) {
  const { command, args } = parseCollaborationCli(argv);
  if (command === 'request-digest') {
    const draft = readJson(args.get('--request'), '--request');
    const request = {
      ...draft,
      requestDigest: computeCollaborationRequestDigest(draft),
    };
    validateCollaborationRequest(request);
    return { valid: true, requestDigest: request.requestDigest };
  }

  const request = readRequest(args.get('--request'));
  const policy = (dependencies.loadPolicy ?? loadCapabilityPolicy)(POLICY_PATH);
  const execution = validateExecution(request, args, policy);
  if (command === 'validate') {
    return {
      valid: true,
      requestDigest: request.requestDigest,
      action: request.action,
      executionMode: execution.handoff.executionMode,
      eligibility: execution.eligibility,
    };
  }

  const collectState = dependencies.collectState ?? collectLiveCollaborationState;
  const preState = collectState(request, { runner: dependencies.runner });
  const decision = authorizeCollaborationMutation({
    request,
    liveState: preState,
    executionMode: execution.handoff.executionMode,
    executionModeSource: execution.handoff.executionModeSource,
    policy,
    selfAssessment: execution.selfAssessment,
  });
  if (!decision.allowed) return decision;

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
    });
  }

  const applyMutation = dependencies.applyMutation ?? applyGitHubCollaborationMutation;
  const applied = applyMutation(request, preState, {
    collectState,
    runner: dependencies.runner,
  });
  return buildCollaborationReceipt({
    request,
    preState,
    postState: applied.postState,
    actor: preState.viewerLogin,
    outcome: 'applied',
    mutationCount: applied.mutationCount,
    reconciliationCount: applied.reconciliationCount,
    platformObject: applied.platformObject,
    verifiedAt: applied.postState.observedAt,
    verification:
      request.action === 'post-bounded-reconciliation-comment'
        ? 'idempotency-marker-present'
        : 'live-state-matches-desired',
    note: applied.reconciled
      ? 'The unique request marker proved the exact comment after one unknown-outcome reconciliation.'
      : 'The exact desired state was verified after the single authorized mutation.',
  });
}

const direct = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  try {
    const output = runCollaborationCli(process.argv.slice(2));
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`[agent:collaborate] ${error.message}\n`);
    process.exitCode = 1;
  }
}
