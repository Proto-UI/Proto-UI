import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
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
} from './review-runtime.mjs';
import { loadSkillRegistry, skillRegistryRoot, validateSkillHandoff } from './skill-registry.mjs';

function usage() {
  return [
    'Usage:',
    '  pnpm agent:review -- input-digest --input <review-input.json>',
    '  pnpm agent:review -- validate --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>]',
    '  pnpm agent:review -- inspect --packet <packet.json> --input <review-input.json> --handoff <handoff.json> --current-base <sha> --current-head <sha> [--assessment <result.json>] [--prior-head <sha>] [--seen-keys <comma-separated>]',
    '  pnpm agent:review -- eligibility --handoff <handoff.json> --review-class <class> [--assessment <result.json>]',
    '  pnpm agent:review -- authorize-submission --packet <packet.json> --input <review-input.json> --handoff <handoff.json> [--assessment <result.json>] --authorization explicit-current-user --credential can-review --reviewer <login> --pr-author <login> [--ci-conclusion <value>]',
  ].join('\n');
}

function parse(argv) {
  if (argv[0] === '--') argv = argv.slice(1);
  const command = argv.shift();
  if (
    !['input-digest', 'validate', 'inspect', 'eligibility', 'authorize-submission'].includes(
      command
    )
  ) {
    throw new Error(usage());
  }
  if (argv.length % 2 !== 0) throw new Error(usage());
  const args = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!name.startsWith('--') || value === undefined || args.has(name)) throw new Error(usage());
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

function readLivePullRequestRevision(packet) {
  const match = packet.repositoryId.match(/^github\.com:([^/]+)\/([^/]+)$/);
  if (!match) throw new Error('review submission requires a github.com repositoryId');
  const [, owner, repository] = match;
  const raw = execFileSync(
    'gh',
    [
      'pr',
      'view',
      String(packet.pullRequest),
      '--repo',
      `${owner}/${repository}`,
      '--json',
      'baseRefOid,headRefOid',
    ],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  const revision = JSON.parse(raw);
  if (!revision.baseRefOid || !revision.headRefOid) {
    throw new Error('live pull-request revision is incomplete');
  }
  return { currentBaseSha: revision.baseRefOid, currentHeadSha: revision.headRefOid };
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
    const liveRevision =
      execution.handoff.executionMode === 'human-assisted'
        ? readLivePullRequestRevision(packet)
        : { currentBaseSha: null, currentHeadSha: null };
    output = authorizeReviewSubmission({
      packet,
      input,
      ...liveRevision,
      executionMode: execution.handoff.executionMode,
      explicitAuthorization: args.get('--authorization') === 'explicit-current-user',
      credentialCanReview: args.get('--credential') === 'can-review',
      reviewer: args.get('--reviewer'),
      pullRequestAuthor: args.get('--pr-author'),
      recommendedAction: packet.recommendedAction,
      ciConclusion: args.get('--ci-conclusion') ?? 'unknown',
    });
  }
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`[agent:review] ${error.message}\n`);
  process.exitCode = 1;
}
