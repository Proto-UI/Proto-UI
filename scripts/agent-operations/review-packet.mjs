import { ownerAuthorizationFromArgs } from './owner-authorization.mjs';
import fs from 'node:fs';
import process from 'node:process';
import {
  assertModelTraceInputsOutsideCheckout,
  loadModelTraceRecord,
  readModelTraceJson,
} from './modeltrace.mjs';
import { readPublishedReviewPacket } from './published-review-packet.mjs';
import {
  collectRepositorySnapshot,
  isSelfAssessmentFresh,
  loadCapabilityPolicy,
  validateSelfAssessmentResult,
} from './assessment-runtime.mjs';
import {
  computeReviewInputDigest,
  computeReviewIngestionInputDigest,
  computeReviewPacketDigest,
  evaluateReviewEligibility,
  inspectReviewRevision,
  decideReviewRun,
  renderReviewBody,
  reviewPacketKey,
  validateReviewInputSnapshot,
  validateReviewInputForIngestion,
  validateReviewPacket,
  validateReviewPacketEligibility,
  verifyReconciliation,
} from './review-runtime.mjs';
import {
  authorizeLivePullRequestMerge,
  authorizeLiveReviewSubmission,
  collectLiveReviewInput,
  submitGitHubMerge,
  submitGitHubReview,
} from './collect-live-review-input.mjs';
import {
  establishExecutionMode,
  evaluateSkillEligibility,
  loadSkillRegistry,
  skillRegistryRoot,
  validateSkillHandoff,
  requireCompletedHandoff,
} from './skill-registry.mjs';

function usage() {
  return [
    'Usage:',
    '  pnpm agent:review -- input-digest --input <review-input.json>',
    '  pnpm agent:review -- validate --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>] [--prior-handoff <received-handoff.json>]',
    '  pnpm agent:review -- inspect --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--prior-handoff <received-handoff.json>] --current-base <sha> --current-head <sha> [--assessment <result.json>] [--prior-head <sha>] [--seen-keys <comma-separated>] [--prior-packet <prior-packet.json>]',
    '  pnpm agent:review -- eligibility --handoff <handoff.json> [--prior-handoff <received-handoff.json>] --review-class <class> [--assessment <result.json>]',
    '  pnpm agent:review -- submit-review --mode human-assisted|autonomous --mode-source <source> --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--prior-handoff <received-handoff.json>]  --record <modeltrace-record.json> --context <modeltrace-context.json> [--assessment <result.json>] [--external-evidence-file <evidence.json>] [--prior-packet <prior-packet.json>] --authorization <explicit-current-user|proto-ui-scheduled-review-v1|owner-grant-id>',
    '  pnpm agent:review -- merge-pull-request --mode human-assisted|autonomous --mode-source <source> --packet <packet.json> --input <review-input.json> --published-review-packet <original-approved-packet.json> --handoff <handoff.json>  --record <modeltrace-record.json> --context <modeltrace-context.json> [--assessment <result.json>] [--external-evidence-file <evidence.json>] --authorization <explicit-current-user|proto-ui-scheduled-merge-v1|owner-grant-id>',
    '',
    'input-digest, validate, and inspect preserve canonical v3 input for read-only legacy schema v1 COMMENT ingestion. v3 inputs cannot enter submit-review or merge-pull-request; those commands require a freshly collected v5 snapshot. v4 must also be re-collected.',
    '',
    'Validation-origin review handoffs require --prior-handoff <received-handoff.json> for validate, inspect, eligibility and submit-review. This compares supplied structure, not authenticated provenance or execution.',
    'submit-review and merge-pull-request require mode and source declared independently by the launcher/operator before artifact reads, matching the handoff. These arguments are declarations, not runtime attestation. Read-only review commands retain legacy ingestion, but validation-origin handoffs additionally require their received --prior-handoff.',
    '',
    'Owner-delegated commands also require independently supplied --owner-authorization <signed-state.json> --owner-key <trusted-public.pem> --owner-grant <id>, with --authorization binding the same grant ID. Owner proof never substitutes for the current ModelTrace record or expands the live permission, contributor, CI/DCO or publication gates.',
    '',
    'submit-review and merge-pull-request re-collect the canonical review input live from GitHub and derive identity, permission, trusted CI, and pull-request state instead of accepting caller-provided claims. Review writes bind commit_id to the packet head; merge writes bind sha to the same head. Schema v1 packets remain read-only COMMENT ingestion; current Agent review writes and merges require schema v2. A merge requires the original --published-review-packet artifact (at most 64 MiB), authenticated by both its complete packet and evidence tokens in the same valid exact-head independent APPROVED review. Re-collection may add only that publication and its newly required reviewer permission; base, scope and other input changes require a new review. The refreshed merge packet may change only reviewInputDigest and observedAt. The supplied file alone provides no authority. externalEvidence cannot be re-collected live: pass the exact recorded array with --external-evidence-file, otherwise a packet recorded with external evidence fails the digest check.',
    '',
    '  pnpm agent:review:smoke -- <repositoryId> <pullRequest>   # exercise the live collector against the real GitHub GraphQL schema',
  ].join('\n');
}

const COMMANDS = [
  'input-digest',
  'validate',
  'inspect',
  'eligibility',
  'submit-review',
  'merge-pull-request',
];
const ALLOWED_OPTIONS = new Map([
  ['input-digest', new Set(['--input'])],
  ['validate', new Set(['--packet', '--input', '--handoff', '--assessment'])],
  [
    'inspect',
    new Set([
      '--packet',
      '--input',
      '--handoff',
      '--assessment',
      '--current-base',
      '--current-head',
      '--prior-head',
      '--seen-keys',
      '--prior-packet',
    ]),
  ],
  ['eligibility', new Set(['--handoff', '--review-class', '--assessment'])],
  [
    'submit-review',
    new Set([
      '--mode',
      '--mode-source',
      '--packet',
      '--input',
      '--handoff',
      '--assessment',
      '--authorization',
      '--owner-authorization',
      '--owner-key',
      '--owner-grant',
      '--external-evidence-file',
      '--record',
      '--context',
      '--prior-packet',
    ]),
  ],
  [
    'merge-pull-request',
    new Set([
      '--mode',
      '--mode-source',
      '--published-review-packet',
      '--packet',
      '--input',
      '--handoff',
      '--assessment',
      '--authorization',
      '--owner-authorization',
      '--owner-key',
      '--owner-grant',
      '--external-evidence-file',
      '--record',
      '--context',
    ]),
  ],
]);

for (const command of ['validate', 'inspect', 'eligibility', 'submit-review'])
  ALLOWED_OPTIONS.get(command).add('--prior-handoff');

for (const command of ['validate', 'inspect', 'eligibility'])
  for (const option of [
    '--mode',
    '--mode-source',
    '--owner-authorization',
    '--owner-key',
    '--owner-grant',
  ])
    ALLOWED_OPTIONS.get(command).add(option);

function loadReadOnlyInvocationContext(args) {
  const declared = [
    '--mode',
    '--mode-source',
    '--owner-authorization',
    '--owner-key',
    '--owner-grant',
  ].some((name) => args.has(name));
  return declared ? loadInvocationContext(args) : null;
}

function parse(argv) {
  if (argv[0] === '--') argv = argv.slice(1);
  const command = argv.shift();
  if (!COMMANDS.includes(command)) throw new Error(usage());
  if (argv.length % 2 !== 0) throw new Error(usage());
  const args = new Map();
  const allowed = ALLOWED_OPTIONS.get(command);
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(name))
      throw new Error(`unexpected option for ${command}: ${name}\n${usage()}`);
    if (value === undefined || args.has(name)) throw new Error(usage());
    args.set(name, value);
  }
  return { command, args };
}

function readInput(path, { readOnly = false } = {}) {
  if (!path) throw new Error('--input is required');
  const input = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (readOnly) return validateReviewInputForIngestion(input);
  if (input?.schemaVersion === 3) {
    throw new Error(
      'legacy review input v3 is read-only; re-collect v5 before a review submission or merge'
    );
  }
  return validateReviewInputSnapshot(input);
}

function readPacket(path, input) {
  if (!path) throw new Error('--packet is required');
  return validateReviewPacket(JSON.parse(fs.readFileSync(path, 'utf8')), input);
}

function loadAssessment(path, policy) {
  if (!path) return null;
  const result = JSON.parse(fs.readFileSync(path, 'utf8'));
  validateSelfAssessmentResult(result, policy);
  const snapshot = collectRepositorySnapshot(skillRegistryRoot, {
    repositoryId: result.scope.repositoryId,
  });
  return { ...result, validated: true, fresh: isSelfAssessmentFresh(result, snapshot) };
}

function loadInvocationContext(args, command) {
  const executionMode = args.get('--mode');
  const executionModeSource = args.get('--mode-source');
  if (!executionMode)
    throw new Error('--mode is required for submit-review and merge-pull-request');
  if (!executionModeSource)
    throw new Error('--mode-source is required for submit-review and merge-pull-request');
  establishExecutionMode(executionMode, executionModeSource);
  if (command === 'submit-review' || command === 'merge-pull-request') {
    assertModelTraceInputsOutsideCheckout({
      recordPath: args.get('--record'),
      contextPath: args.get('--context'),
      checkoutRoot: skillRegistryRoot,
      forbiddenPaths: [
        args.get('--handoff'),
        args.get('--owner-authorization'),
        args.get('--owner-key'),
        args.get('--input'),
        args.get('--packet'),
        args.get('--published-review-packet'),
        args.get('--request'),
        args.get('--assessment'),
        args.get('--prior-handoff'),
        args.get('--prior-packet'),
      ],
    });
  }
  // Retain the launcher/operator declaration independently of task-authored
  // artifacts. Matching declarations do not authenticate the caller.
  return Object.freeze({
    executionMode,
    executionModeSource,
    ownerAuthorization: ownerAuthorizationFromArgs(args),
  });
}

function loadHandoff(path, nextSkillId, invocationContext = null, priorPath = null) {
  if (!path) throw new Error('--handoff is required');
  const handoff = JSON.parse(fs.readFileSync(path, 'utf8'));
  if (invocationContext) {
    for (const field of ['executionMode', 'executionModeSource']) {
      if (handoff?.[field] !== invocationContext[field]) {
        throw new Error(`handoff ${field} does not match the independent invocation declaration`);
      }
    }
  }
  requireCompletedHandoff(handoff);
  const priorHandoff = priorPath ? JSON.parse(fs.readFileSync(priorPath, 'utf8')) : null;
  const result = validateSkillHandoff(handoff, loadSkillRegistry(), { priorHandoff });
  if (result.nextSkill?.id !== nextSkillId) {
    throw new Error(`handoff must select ${nextSkillId}`);
  }
  return result;
}

function validateReviewHandoffTarget(handoff, packet, input, inputPath) {
  if (handoff.schemaVersion !== 2) return;
  const digest =
    input.schemaVersion === 3
      ? computeReviewIngestionInputDigest(input)
      : computeReviewInputDigest(input);
  const binding = handoff.binding;
  if (
    binding.repositoryId !== packet.repositoryId ||
    binding.repositoryId !== input.repositoryId ||
    binding.scopeId !== 'pull-request:' + packet.pullRequest ||
    packet.pullRequest !== input.pullRequest ||
    binding.headSha !== packet.headSha ||
    binding.headSha !== input.headSha ||
    binding.reviewInputDigest !== digest ||
    packet.reviewInputDigest !== digest
  )
    throw Error('v2 review handoff target binding differs from supplied packet/input');
  const artifacts = handoff.artifacts.filter((a) => a.type === 'review-input');
  if (
    artifacts.length !== 1 ||
    artifacts[0].reference !== inputPath ||
    artifacts[0].digest !== 'sha256:' + digest ||
    artifacts[0].revision !== input.headSha
  )
    throw Error('v2 review-input artifact does not bind supplied input path, digest and revision');
}

function validateExecution(args, packet, policy, executionMode, invocationContext = {}) {
  const selfAssessment = loadAssessment(args.get('--assessment'), policy);
  const eligibility = evaluateReviewEligibility({
    executionMode,
    reviewClass: packet.reviewClass,
    selfAssessment,
    policy,
    ownerAuthorization: invocationContext.ownerAuthorization,
    executionModeSource: invocationContext.executionModeSource,
    repositoryId: packet.repositoryId,
    scopeId: 'pull-request:' + packet.pullRequest,
  });
  validateReviewPacketEligibility(packet, eligibility, executionMode);
  return { eligibility, selfAssessment };
}
function validateIntegrationExecution(args, packet, input, policy, routed, invocationContext) {
  validateReviewHandoffTarget(routed.handoff, packet, input, args.get('--input'));
  const selfAssessment = loadAssessment(args.get('--assessment'), policy);
  // The reviewed content ceiling was established by the independent reviewer
  // when this packet was sealed; recomputing it against the integrator's
  // assessment would reapply the review-class ceiling to an actor who only
  // performs the bounded integration mutation. Validate the packet against
  // its declared review class without an actor ceiling, and apply the C2
  // integration ceiling to the current actor via evaluateSkillEligibility
  // below.
  const reviewEligibility = evaluateReviewEligibility({
    executionMode: 'human-assisted',
    reviewClass: packet.reviewClass,
    selfAssessment: null,
    policy,
  });
  validateReviewPacketEligibility(packet, reviewEligibility, 'human-assisted');
  const packetArtifact = routed.handoff.artifacts.find(
    (artifact) => artifact.type === 'review-packet'
  );
  if (!packetArtifact || packetArtifact.reference !== args.get('--packet')) {
    throw new Error(
      'integration handoff review-packet artifact does not bind the --packet argument'
    );
  }
  if (packetArtifact.digest !== `sha256:${computeReviewPacketDigest(packet)}`) {
    throw new Error('integration handoff review-packet artifact does not bind packet content');
  }
  const inputArtifact = routed.handoff.artifacts.find(
    (artifact) => artifact.type === 'review-input'
  );
  if (!inputArtifact || inputArtifact.reference !== args.get('--input')) {
    throw new Error('integration handoff review-input artifact does not bind the --input argument');
  }
  if (inputArtifact.digest !== `sha256:${computeReviewInputDigest(input)}`) {
    throw new Error('integration handoff review-input artifact does not bind input content');
  }
  const authorizationArtifact = routed.handoff.artifacts.find(
    (artifact) => artifact.type === 'mutation-authorization'
  );
  if (!authorizationArtifact || authorizationArtifact.reference !== args.get('--authorization')) {
    throw new Error(
      'integration handoff mutation-authorization artifact does not bind --authorization'
    );
  }
  const skillEligibility = evaluateSkillEligibility(routed.nextSkill, {
    executionMode: invocationContext.executionMode,
    selfAssessment,
    entrypoint: routed.handoff.entrypoint,
    ownerAuthorization: invocationContext.ownerAuthorization,
    executionModeSource: invocationContext.executionModeSource,
    repositoryId: packet.repositoryId,
    scopeId: 'pull-request:' + packet.pullRequest,
  });
  if (!skillEligibility.eligible) {
    throw new Error(skillEligibility.reason);
  }
  const publishedPacketPath = args.get('--published-review-packet');
  if (!publishedPacketPath)
    throw new Error('--published-review-packet is required for merge-pull-request');
  const publishedPacketArtifact = routed.handoff.artifacts.find(
    (artifact) => artifact.type === 'published-review-packet'
  );
  if (!publishedPacketArtifact || publishedPacketArtifact.reference !== publishedPacketPath) {
    throw new Error(
      'integration handoff published-review-packet artifact does not bind the --published-review-packet argument'
    );
  }
  const publishedPacket = readPublishedReviewPacket(publishedPacketPath, packet);
  if (publishedPacketArtifact.digest !== `sha256:${computeReviewPacketDigest(publishedPacket)}`) {
    throw new Error(
      'integration handoff published-review-packet artifact does not bind original packet content'
    );
  }
  return {
    reviewEligibility,
    selfAssessment,
    skillEligibility,
    publishedPacket,
  };
}

function readExternalEvidence(args) {
  const externalEvidencePath = args.get('--external-evidence-file');
  if (!externalEvidencePath) return [];
  const parsed = JSON.parse(fs.readFileSync(externalEvidencePath, 'utf8'));
  if (!Array.isArray(parsed)) {
    throw new Error('--external-evidence-file must contain a JSON array');
  }
  return parsed;
}

function loadModelTraceInvocation(args, packet, handoff) {
  const modelTrace = loadModelTraceRecord({
    recordPath: args.get('--record'),
    contextPath: args.get('--context'),
    repositoryId: packet.repositoryId,
  });
  const artifact = handoff.artifacts.find((item) => item.type === 'modeltrace-record');
  if (artifact?.reference !== args.get('--record') || artifact.digest !== modelTrace.id)
    throw new Error('review handoff must bind the --record reference and measured receipt digest');
  return { modelTrace, modelTraceContext: readModelTraceJson(args.get('--context'), 'context') };
}

try {
  const { command, args } = parse(process.argv.slice(2));
  let output;
  if (command === 'input-digest') {
    const input = readInput(args.get('--input'), { readOnly: true });
    output = { valid: true, reviewInputDigest: computeReviewIngestionInputDigest(input) };
  } else if (command === 'validate') {
    const invocationContext = loadReadOnlyInvocationContext(args);
    const input = readInput(args.get('--input'), { readOnly: true });
    const packet = readPacket(args.get('--packet'), input);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const { handoff } = loadHandoff(
      args.get('--handoff'),
      'pui-review',
      invocationContext,
      args.get('--prior-handoff')
    );
    validateReviewHandoffTarget(handoff, packet, input, args.get('--input'));
    const execution = validateExecution(
      args,
      packet,
      policy,
      handoff.executionMode,
      invocationContext ?? {}
    );
    output = {
      valid: true,
      key: reviewPacketKey(packet, input),
      executionMode: handoff.executionMode,
      eligibility: execution.eligibility,
    };
  } else if (command === 'inspect') {
    const invocationContext = loadReadOnlyInvocationContext(args);
    const input = readInput(args.get('--input'), { readOnly: true });
    const packet = readPacket(args.get('--packet'), input);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const { handoff } = loadHandoff(
      args.get('--handoff'),
      'pui-review',
      invocationContext,
      args.get('--prior-handoff')
    );
    validateReviewHandoffTarget(handoff, packet, input, args.get('--input'));
    const execution = validateExecution(
      args,
      packet,
      policy,
      handoff.executionMode,
      invocationContext ?? {}
    );
    const currentBase = args.get('--current-base');
    const currentHead = args.get('--current-head');
    if (!currentBase || !currentHead)
      throw new Error('--current-base and --current-head are required');
    const seenKeys = (args.get('--seen-keys') ?? '')
      .split(',')
      .map((key) => key.trim())
      .filter(Boolean);
    let reconciliationBound = null;
    if (packet.reconciliation.priorPacketDigest !== null) {
      const priorPath = args.get('--prior-packet');
      if (!priorPath)
        throw new Error('--prior-packet is required when the packet reconciles a prior review');
      const priorPacket = JSON.parse(fs.readFileSync(priorPath, 'utf8'));
      verifyReconciliation(packet, priorPacket);
      reconciliationBound = true;
    }
    output = {
      key: reviewPacketKey(packet, input),
      revision: inspectReviewRevision(
        packet,
        input,
        currentHead,
        args.get('--prior-head') ?? null,
        currentBase
      ),
      run: decideReviewRun(packet, input, seenKeys),
      executionMode: handoff.executionMode,
      eligibility: execution.eligibility,
      reconciliationBound,
    };
  } else if (command === 'eligibility') {
    const invocationContext = loadReadOnlyInvocationContext(args);
    const { handoff } = loadHandoff(
      args.get('--handoff'),
      'pui-review',
      invocationContext,
      args.get('--prior-handoff')
    );
    const reviewClass = args.get('--review-class');
    if (!reviewClass) throw new Error('--review-class is required');
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const selfAssessment = loadAssessment(args.get('--assessment'), policy);
    output = evaluateReviewEligibility({
      executionMode: handoff.executionMode,
      reviewClass,
      selfAssessment,
      policy,
      ownerAuthorization: invocationContext?.ownerAuthorization,
      executionModeSource: invocationContext?.executionModeSource,
      repositoryId:
        handoff.binding?.repositoryId ?? invocationContext?.ownerAuthorization?.repositoryId,
      scopeId: handoff.binding?.scopeId,
    });
  } else if (command === 'submit-review') {
    const invocationContext = loadInvocationContext(args, command);
    const { handoff } = loadHandoff(
      args.get('--handoff'),
      'pui-review',
      invocationContext,
      args.get('--prior-handoff')
    );
    const input = readInput(args.get('--input'));
    const packet = readPacket(args.get('--packet'), input);
    const { modelTrace, modelTraceContext } = loadModelTraceInvocation(args, packet, handoff);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    validateReviewHandoffTarget(handoff, packet, input, args.get('--input'));
    const execution = validateExecution(
      args,
      packet,
      policy,
      invocationContext.executionMode,
      invocationContext
    );
    const externalEvidence = readExternalEvidence(args);
    const priorPath = args.get('--prior-packet');
    const priorPacket = priorPath ? JSON.parse(fs.readFileSync(priorPath, 'utf8')) : null;
    // Submission must consume the bound prior packet whenever the packet
    // records one; an incremental reconciliation that is never verified
    // against its prior findings would otherwise publish unchecked state.
    if (packet.reconciliation.priorPacketDigest !== null) {
      if (!priorPath)
        throw new Error('--prior-packet is required when the packet reconciles a prior review');
      verifyReconciliation(packet, priorPacket);
    }
    const live = collectLiveReviewInput(packet.repositoryId, packet.pullRequest, {
      externalEvidence,
    });
    const reviewAuthorizationContext = {
      packet,
      input,
      priorPacket,
      ...invocationContext,
      authorizationId: args.get('--authorization'),
      policy,
      selfAssessment: execution.selfAssessment,
      actor: live.viewerLogin,
      viewerPermission: live.viewerPermission,
      externalEvidence,
      modelTrace,
      modelTraceContext,
    };
    const authorization = authorizeLiveReviewSubmission(reviewAuthorizationContext, live);
    if (!authorization.allowed) {
      output = authorization;
    } else {
      const receipt = submitGitHubReview(
        packet.repositoryId,
        packet.pullRequest,
        {
          commitId: packet.headSha,
          event: authorization.recommendedAction,
          body: renderReviewBody(packet),
        },
        undefined,
        {
          reviewerLogin: live.viewerLogin,
          authorizationContext: reviewAuthorizationContext,
          invocationId: `${packet.repositoryId}:${packet.pullRequest}:${packet.headSha}:${authorization.recommendedAction}`,
          modelTrace,
          modelTraceContext,
        }
      );
      output = {
        ...authorization,
        permissionsObservedAt: live.permissionsObservedAt,
        submitted: receipt.status === 'applied',
        receipt,
      };
    }
  } else {
    const invocationContext = loadInvocationContext(args, command);
    const routed = loadHandoff(args.get('--handoff'), 'pui-integrate', invocationContext);
    const input = readInput(args.get('--input'));
    const packet = readPacket(args.get('--packet'), input);
    const { modelTrace, modelTraceContext } = loadModelTraceInvocation(
      args,
      packet,
      routed.handoff
    );
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const execution = validateIntegrationExecution(
      args,
      packet,
      input,
      policy,
      routed,
      invocationContext
    );
    const publishedPacket = execution.publishedPacket;
    const externalEvidence = readExternalEvidence(args);
    const live = collectLiveReviewInput(packet.repositoryId, packet.pullRequest, {
      externalEvidence,
    });
    const authorizationContext = {
      packet,
      publishedPacket,
      input,
      ...invocationContext,
      authorizationId: args.get('--authorization'),
      policy,
      selfAssessment: execution.selfAssessment,
      actor: live.viewerLogin,
      viewerPermission: live.viewerPermission,
      externalEvidence,
      modelTrace,
      modelTraceContext,
    };
    const authorization = authorizeLivePullRequestMerge(authorizationContext, live);
    if (!authorization.allowed) {
      output = authorization;
    } else {
      const receipt = submitGitHubMerge(packet.repositoryId, packet.pullRequest, {
        headSha: authorization.headSha,
        expectedBaseSha: packet.baseSha,
        baseRefName: input.baseRefName,
        mergeMethod: authorization.mergeMethod,
        authorizationId: authorization.authorizationId,
        authorizationContext,
      });
      output = {
        ...authorization,
        permissionsObservedAt: receipt.permissionsObservedAt,
        submitted: true,
        receipt,
      };
    }
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`[agent:review] ${error.message}\n`);
  process.exitCode = 1;
}
