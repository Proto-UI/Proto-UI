import fs from 'node:fs';
import process from 'node:process';
import {
  establishExecutionMode,
  evaluateSkillEligibility,
  loadSkillRegistry,
  resolveSkill,
  validateSkillHandoff,
} from './skill-registry.mjs';
import {
  collectRepositorySnapshot,
  loadCapabilityPolicy,
  validateSelfAssessmentResult,
} from './assessment-runtime.mjs';
import { skillRegistryRoot } from './skill-registry.mjs';

function usage() {
  return 'Usage: pnpm agent:skill -- <leaf-id> [--mode human-assisted|autonomous --mode-source <trusted-source>] [--assessment <result.json>] | --handoff <handoff.json> [--assessment <result.json>]\n';
}

function parse(argv) {
  if (argv[0] === '--') argv = argv.slice(1);
  const handoffIndex = argv.indexOf('--handoff');
  const modeIndex = argv.indexOf('--mode');
  const modeSourceIndex = argv.indexOf('--mode-source');
  const assessmentIndex = argv.indexOf('--assessment');
  const args = {};
  if (handoffIndex >= 0) args.handoffPath = argv[handoffIndex + 1];
  else if (argv[0] && !argv[0].startsWith('-')) args.id = argv[0];
  if (modeIndex >= 0) args.executionMode = argv[modeIndex + 1];
  if (modeSourceIndex >= 0) args.executionModeSource = argv[modeSourceIndex + 1];
  if (assessmentIndex >= 0) args.assessmentPath = argv[assessmentIndex + 1];
  if (
    (args.handoffPath || (args.id && modeIndex >= 0 && modeSourceIndex >= 0)) &&
    ![handoffIndex, modeIndex, modeSourceIndex, assessmentIndex].some(
      (i) => i >= 0 && !argv[i + 1]
    ) &&
    (modeIndex < 0 || modeSourceIndex >= 0)
  )
    return args;
  throw new Error(usage().trim());
}

try {
  const args = parse(process.argv.slice(2));
  const registry = loadSkillRegistry();
  let skill;
  let terminal = false;
  if (args.handoffPath) {
    const handoff = JSON.parse(fs.readFileSync(args.handoffPath, 'utf8'));
    const result = validateSkillHandoff(handoff, registry);
    skill = result.nextSkill;
    terminal = skill === null;
  } else {
    skill = resolveSkill(args.id, registry);
  }
  const executionMode =
    args.executionMode ??
    (args.handoffPath ? JSON.parse(fs.readFileSync(args.handoffPath, 'utf8')).executionMode : null);
  if (args.executionMode) establishExecutionMode(args.executionMode, args.executionModeSource);
  let selfAssessment = null;
  if (args.assessmentPath) {
    const result = JSON.parse(fs.readFileSync(args.assessmentPath, 'utf8'));
    const policy = loadCapabilityPolicy(
      new URL('../../internal/agent-operations/capability-policy.yaml', import.meta.url)
    );
    validateSelfAssessmentResult(result, policy);
    const snapshot = collectRepositorySnapshot(skillRegistryRoot, {
      assessmentMode: 'self-assessment',
      repositoryId: result.scope?.repositoryId,
    });
    const bindings = [
      'repositoryId',
      'baseSha',
      'treeSha',
      'worktreeDigest',
      'catalogDigest',
      'policyDigest',
    ];
    const fresh =
      result.kind === 'proto-ui.agent-capability-self-result' &&
      Date.now() <= Date.parse(result.validity?.expiresAt) &&
      bindings.every((key) => result.scope?.[key] === snapshot[key]);
    selfAssessment = { ...result, fresh, validated: true };
  }
  const eligibility =
    executionMode && skill
      ? evaluateSkillEligibility(skill, { executionMode, selfAssessment })
      : null;
  const blocked = eligibility?.eligible === false;
  const output = terminal
    ? { schemaVersion: 1, terminal: true, blocked: false, eligibility: null, skill: null }
    : blocked
      ? { schemaVersion: 1, terminal: false, blocked: true, eligibility, skill: null }
      : {
          schemaVersion: 1,
          terminal: false,
          blocked: false,
          eligibility,
          skill: {
            id: skill.id,
            entrypoints: skill.entrypoints,
            loadPath: skill.loadPath,
            transition: skill.transition,
            autonomousMinimumBand: skill.autonomousMinimumBand,
            taskClass: skill.taskClass,
            mutation: skill.mutation,
            requires: skill.requires,
            produces: skill.produces,
          },
        };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`[agent:skill] ${error.message}\n`);
  process.exitCode = 1;
}
