import fs from 'node:fs';
import process from 'node:process';
import {
  collectRepositorySnapshot,
  isSelfAssessmentFresh,
  loadCapabilityPolicy,
  validateSelfAssessmentResult,
} from './assessment-runtime.mjs';
import {
  authorizePullRequestMerge,
  authorizeReviewSubmission,
  computeReviewInputDigest,
  decideReviewRun,
  evaluateReviewEligibility,
  inspectReviewRevision,
  reviewPacketKey,
  validateReviewInputSnapshot,
  validateReviewPacket,
  validateReviewPacketEligibility,
  verifyReconciliation,
} from './review-runtime.mjs';
import {
  collectLiveReviewInput,
  submitGitHubMerge,
  submitGitHubReview,
  summarizeLiveChecks,
} from './collect-live-review-input.mjs';
import {
  evaluateSkillEligibility,
  loadSkillRegistry,
  skillRegistryRoot,
  validateSkillHandoff,
} from './skill-registry.mjs';

function usage() {
  return [
    'Usage:',
    '  pnpm agent:review -- input-digest --input <review-input.json>',
    '  pnpm agent:review -- validate --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>]',
    '  pnpm agent:review -- inspect --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --current-base <sha> --current-head <sha> [--assessment <result.json>] [--prior-head <sha>] [--seen-keys <comma-separated>] [--prior-packet <prior-packet.json>]',
    '  pnpm agent:review -- eligibility --handoff <handoff.json> --review-class <class> [--assessment <result.json>]',
    '  pnpm agent:review -- submit-review --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>] [--external-evidence-file <evidence.json>] --authorization <explicit-current-user|proto-ui-scheduled-review-v1>',
    '  pnpm agent:review -- merge-pull-request --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>] [--external-evidence-file <evidence.json>] --authorization <explicit-current-user|proto-ui-scheduled-merge-v1>',
    '',
    'submit-review and merge-pull-request re-collect the canonical review input live from GitHub and derive identity, permission, trusted CI, and pull-request state instead of accepting caller-provided claims. Review writes bind commit_id to the packet head; merge writes bind sha to the same head. externalEvidence cannot be re-collected live: pass the exact recorded array with --external-evidence-file, otherwise a packet recorded with external evidence fails the digest check.',
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
      '--packet',
      '--input',
      '--handoff',
      '--assessment',
      '--authorization',
      '--external-evidence-file',
    ]),
  ],
  [
    'merge-pull-request',
    new Set([
      '--packet',
      '--input',
      '--handoff',
      '--assessment',
      '--authorization',
      '--external-evidence-file',
    ]),
  ],
]);

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

function readInput(path) {
  if (!path) throw new Error('--input is required');
  return validateReviewInputSnapshot(JSON.parse(fs.readFileSync(path, 'utf8')));
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

function loadReviewHandoff(path) {
  if (!path) throw new Error('--handoff is required');
  const registry = loadSkillRegistry();
  const handoff = JSON.parse(fs.readFileSync(path, 'utf8'));
  const result = validateSkillHandoff(handoff, registry);
  if (result.nextSkill?.id !== 'pui-review') {
    throw new Error('handoff must select pui-review');
  }
  return result.handoff;
}

function loadIntegrationHandoff(path) {
  if (!path) throw new Error('--handoff is required');
  const registry = loadSkillRegistry();
  const handoff = JSON.parse(fs.readFileSync(path, 'utf8'));
  const result = validateSkillHandoff(handoff, registry);
  if (result.nextSkill?.id !== 'pui-integrate') {
    throw new Error('handoff must select pui-integrate');
  }
  return result;
}

function validateExecution(args, packet, policy) {
  const handoff = loadReviewHandoff(args.get('--handoff'));
  const selfAssessment = loadAssessment(args.get('--assessment'), policy);
  const eligibility = evaluateReviewEligibility({
    executionMode: handoff.executionMode,
    reviewClass: packet.reviewClass,
    selfAssessment,
    policy,
  });
  validateReviewPacketEligibility(packet, eligibility, handoff.executionMode);
  return { handoff, eligibility, selfAssessment };
}

function validateIntegrationExecution(args, packet, policy) {
  const routed = loadIntegrationHandoff(args.get('--handoff'));
  const selfAssessment = loadAssessment(args.get('--assessment'), policy);
  const reviewEligibility = evaluateReviewEligibility({
    executionMode: routed.handoff.executionMode,
    reviewClass: packet.reviewClass,
    selfAssessment,
    policy,
  });
  validateReviewPacketEligibility(packet, reviewEligibility, routed.handoff.executionMode);
  const skillEligibility = evaluateSkillEligibility(routed.nextSkill, {
    executionMode: routed.handoff.executionMode,
    selfAssessment,
  });
  if (!skillEligibility.eligible) {
    throw new Error(skillEligibility.reason);
  }
  return {
    handoff: routed.handoff,
    reviewEligibility,
    selfAssessment,
    skillEligibility,
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

function renderReviewBody(packet) {
  const prefix = `Reviewed exact head \`${packet.headSha}\`.`;
  if (packet.findings.length === 0) return prefix;
  return [
    prefix,
    '',
    ...packet.findings.map(
      (finding) =>
        `- **[${finding.severity}] ${finding.id}** (${finding.file}:${finding.line}) ${finding.observed} Expected: ${finding.expected} Fix: ${finding.fix}`
    ),
  ].join('\n');
}

try {
  const { command, args } = parse(process.argv.slice(2));
  let output;
  if (command === 'input-digest') {
    const input = readInput(args.get('--input'));
    output = { valid: true, reviewInputDigest: computeReviewInputDigest(input) };
  } else if (command === 'validate') {
    const input = readInput(args.get('--input'));
    const packet = readPacket(args.get('--packet'), input);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const execution = validateExecution(args, packet, policy);
    output = {
      valid: true,
      key: reviewPacketKey(packet, input),
      executionMode: execution.handoff.executionMode,
      eligibility: execution.eligibility,
    };
  } else if (command === 'inspect') {
    const input = readInput(args.get('--input'));
    const packet = readPacket(args.get('--packet'), input);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const execution = validateExecution(args, packet, policy);
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
      executionMode: execution.handoff.executionMode,
      eligibility: execution.eligibility,
      reconciliationBound,
    };
  } else if (command === 'eligibility') {
    const handoff = loadReviewHandoff(args.get('--handoff'));
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
    });
  } else if (command === 'submit-review') {
    const input = readInput(args.get('--input'));
    const packet = readPacket(args.get('--packet'), input);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const execution = validateExecution(args, packet, policy);
    const externalEvidence = readExternalEvidence(args);
    const live = collectLiveReviewInput(packet.repositoryId, packet.pullRequest, {
      externalEvidence,
    });
    const authorization = authorizeReviewSubmission({
      packet,
      input,
      liveInput: live.input,
      executionMode: execution.handoff.executionMode,
      executionModeSource: execution.handoff.executionModeSource,
      authorizationId: args.get('--authorization'),
      policy,
      selfAssessment: execution.selfAssessment,
      credentialCanReview: ['ADMIN', 'MAINTAIN', 'WRITE'].includes(live.viewerPermission),
      reviewer: live.viewerLogin,
      pullRequestAuthor: live.authorLogin,
      ciConclusion: summarizeLiveChecks(live.input.checks, {
        repositoryId: packet.repositoryId,
        trustedRepositoryId: policy.trustedCiEvidence?.repositoryId,
        trustedSource: policy.trustedCiEvidence?.source,
        trustedCheckNames: policy.trustedCiEvidence?.checkNames,
        trustedWorkflowNames: policy.trustedCiEvidence?.workflowNames,
        trustedWorkflowPaths: policy.trustedCiEvidence?.workflowPaths,
      }),
    });
    if (!authorization.allowed) {
      output = authorization;
    } else {
      const receipt = submitGitHubReview(packet.repositoryId, packet.pullRequest, {
        commitId: packet.headSha,
        event: authorization.recommendedAction,
        body: renderReviewBody(packet),
      });
      output = {
        ...authorization,
        submitted: true,
        receipt,
      };
    }
  } else {
    const input = readInput(args.get('--input'));
    const packet = readPacket(args.get('--packet'), input);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const execution = validateIntegrationExecution(args, packet, policy);
    const externalEvidence = readExternalEvidence(args);
    const live = collectLiveReviewInput(packet.repositoryId, packet.pullRequest, {
      externalEvidence,
    });
    const authorization = authorizePullRequestMerge({
      packet,
      input,
      liveInput: live.input,
      executionMode: execution.handoff.executionMode,
      executionModeSource: execution.handoff.executionModeSource,
      authorizationId: args.get('--authorization'),
      policy,
      selfAssessment: execution.selfAssessment,
      credentialCanMerge: ['ADMIN', 'MAINTAIN', 'WRITE'].includes(live.viewerPermission),
      actor: live.viewerLogin,
      pullRequestAuthor: live.authorLogin,
      ciConclusion: summarizeLiveChecks(live.input.checks, {
        repositoryId: packet.repositoryId,
        trustedRepositoryId: policy.trustedCiEvidence?.repositoryId,
        trustedSource: policy.trustedCiEvidence?.source,
        trustedCheckNames: policy.trustedCiEvidence?.checkNames,
        trustedWorkflowNames: policy.trustedCiEvidence?.workflowNames,
        trustedWorkflowPaths: policy.trustedCiEvidence?.workflowPaths,
      }),
      mergeable: live.mergeable,
      mergeStateStatus: live.mergeStateStatus,
    });
    if (!authorization.allowed) {
      output = authorization;
    } else {
      const receipt = submitGitHubMerge(packet.repositoryId, packet.pullRequest, {
        headSha: authorization.headSha,
        mergeMethod: authorization.mergeMethod,
      });
      output = {
        ...authorization,
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
