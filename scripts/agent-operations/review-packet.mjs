import fs from 'node:fs';
import process from 'node:process';
import {
  collectRepositorySnapshot,
  isSelfAssessmentFresh,
  loadCapabilityPolicy,
  validateSelfAssessmentResult,
} from './assessment-runtime.mjs';
import {
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
import { collectLiveReviewInput, summarizeLiveChecks } from './collect-live-review-input.mjs';
import { loadSkillRegistry, skillRegistryRoot, validateSkillHandoff } from './skill-registry.mjs';

function usage() {
  return [
    'Usage:',
    '  pnpm agent:review -- input-digest --input <review-input.json>',
    '  pnpm agent:review -- validate --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>]',
    '  pnpm agent:review -- inspect --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --current-base <sha> --current-head <sha> [--assessment <result.json>] [--prior-head <sha>] [--seen-keys <comma-separated>] [--prior-packet <prior-packet.json>]',
    '  pnpm agent:review -- eligibility --handoff <handoff.json> --review-class <class> [--assessment <result.json>]',
    '  pnpm agent:review -- authorize-submission --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>] --authorization explicit-current-user',
    '',
    'authorize-submission re-collects the canonical review input live from GitHub and derives the viewer identity, pull-request author, credential permission, and CI conclusion from that live context; caller-provided identities are never accepted.',
  ].join('\n');
}

const COMMANDS = ['input-digest', 'validate', 'inspect', 'eligibility', 'authorize-submission'];
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
    'authorize-submission',
    new Set(['--packet', '--input', '--handoff', '--assessment', '--authorization']),
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
  return { handoff, eligibility };
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
  } else {
    const input = readInput(args.get('--input'));
    const packet = readPacket(args.get('--packet'), input);
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    const execution = validateExecution(args, packet, policy);
    if (execution.handoff.executionMode === 'human-assisted') {
      const live = collectLiveReviewInput(packet.repositoryId, packet.pullRequest);
      output = authorizeReviewSubmission({
        packet,
        input,
        liveInput: live.input,
        executionMode: execution.handoff.executionMode,
        explicitAuthorization: args.get('--authorization') === 'explicit-current-user',
        credentialCanReview: ['ADMIN', 'MAINTAIN', 'WRITE'].includes(live.viewerPermission),
        reviewer: live.viewerLogin,
        pullRequestAuthor: live.authorLogin,
        ciConclusion: summarizeLiveChecks(live.input.checks),
      });
    } else {
      output = authorizeReviewSubmission({
        packet,
        input,
        liveInput: null,
        executionMode: 'autonomous',
        explicitAuthorization: args.get('--authorization') === 'explicit-current-user',
        credentialCanReview: false,
        reviewer: '',
        pullRequestAuthor: '',
        ciConclusion: 'unknown',
      });
    }
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`[agent:review] ${error.message}\n`);
  process.exitCode = 1;
}
