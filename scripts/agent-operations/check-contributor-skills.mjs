import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCapabilityPolicy, validateChallenge } from './assessment-runtime.mjs';
import { loadSkillRegistry } from './skill-registry.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const skillRoot = resolve(root, '.agents/skills');
const failures = [];

function fail(message) {
  failures.push(message);
}

const skillNames = readdirSync(skillRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.startsWith('pui-'))
  .map((entry) => entry.name)
  .sort();

const entrypoints = new Set(['pui-dev', 'pui-maintain']);
if (!skillNames.includes('pui-dev') || !skillNames.includes('pui-maintain')) {
  fail('Both pui-dev and pui-maintain entrypoints must exist.');
}

for (const name of skillNames) {
  const skillPath = resolve(skillRoot, name, 'SKILL.md');
  const metadataPath = resolve(skillRoot, name, 'agents/openai.yaml');
  if (!existsSync(skillPath)) {
    fail(name + ': missing SKILL.md');
    continue;
  }
  if (!existsSync(metadataPath)) {
    fail(name + ': missing agents/openai.yaml');
    continue;
  }

  const skill = readFileSync(skillPath, 'utf8');
  const metadata = readFileSync(metadataPath, 'utf8');
  const frontmatter = skill.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter) {
    fail(name + ': invalid frontmatter');
    continue;
  }

  const keys = [...frontmatter[1].matchAll(/^([a-zA-Z][\w-]*):/gm)].map((match) => match[1]);
  if (keys.join(',') !== 'name,description') {
    fail(name + ': frontmatter must contain only name and description');
  }
  if (!frontmatter[1].includes('name: ' + name)) {
    fail(name + ': frontmatter name does not match folder');
  }
  if (/\[TODO|TODO:/.test(skill)) {
    fail(name + ': unresolved TODO');
  }
  if (skill.split(/\r?\n/).length > 500) {
    fail(name + ': SKILL.md exceeds 500 lines');
  }
  if (!skill.includes("user's current language")) {
    fail(name + ': missing user-language communication rule');
  }
  if (!entrypoints.has(name)) {
    if (!skill.includes('internal/agent-operations/schemas/skill-handoff.schema.json')) {
      fail(name + ': leaf must return the registered skill-handoff shape');
    }
    if (/\binvoke(?:s|d|ing)?\b/i.test(skill)) {
      fail(name + ': leaf must hand off instead of recursively invoking another skill');
    }
  }

  const implicit = metadata.match(/allow_implicit_invocation:\s*(true|false)/)?.[1];
  const expected = entrypoints.has(name) ? 'true' : 'false';
  if (implicit !== expected) {
    fail(name + ': allow_implicit_invocation must be ' + expected);
  }
  if (!metadata.includes('Use $' + name)) {
    fail(name + ': default prompt must mention $' + name);
  }
}

let skillRegistry;
try {
  skillRegistry = loadSkillRegistry({ root });
} catch (error) {
  fail('skills.yaml is not executable: ' + error.message);
}
const registryIds = skillRegistry ? [...skillRegistry.byId.keys()].sort() : [];
const expectedRegistryIds = skillNames.filter((name) => !entrypoints.has(name));
if (JSON.stringify(registryIds) !== JSON.stringify(expectedRegistryIds)) {
  fail('skills.yaml must register every leaf skill exactly once.');
}

const publicSkillCatalogs = [
  resolve(root, 'apps/www/src/content/docs/en/contribute/skills.md'),
  resolve(root, 'apps/www/src/content/docs/zh-cn/contribute/skills.md'),
];
for (const catalogPath of publicSkillCatalogs) {
  const catalog = readFileSync(catalogPath, 'utf8');
  for (const id of registryIds) {
    if (!catalog.includes('`' + id + '`')) {
      fail(catalogPath + ': public skill catalog is missing ' + id);
    }
  }
}

for (const readmePath of [resolve(root, 'README.md'), resolve(root, 'README.zh-CN.md')]) {
  const readme = readFileSync(readmePath, 'utf8');
  if (!readme.includes('Record human-assisted mode when I am directing the work')) {
    fail(readmePath + ': Agent entry must carry the trusted execution mode');
  }
}

const capabilityProjections = [
  resolve(root, 'CONTRIBUTING.md'),
  resolve(root, 'apps/www/src/content/docs/en/contribute/agents.md'),
  resolve(root, 'apps/www/src/content/docs/en/contribute/collaboration.md'),
];
for (const projectionPath of capabilityProjections) {
  const projection = readFileSync(projectionPath, 'utf8');
  if (!projection.includes('human-assisted') || !projection.includes('autonomous')) {
    fail(projectionPath + ': both execution modes must be explained');
  }
}
for (const projectionPath of [
  resolve(root, 'apps/www/src/content/docs/zh-cn/contribute/agents.md'),
  resolve(root, 'apps/www/src/content/docs/zh-cn/contribute/collaboration.md'),
]) {
  const projection = readFileSync(projectionPath, 'utf8');
  if (!projection.includes('human-assisted') || !projection.includes('autonomous')) {
    fail(projectionPath + ': 两种执行模式缺失');
  }
}

const bilingualAgentSemantics = [
  {
    path: resolve(root, 'apps/www/src/content/docs/en/contribute/agents.md'),
    required: [
      'It does not block the work you explicitly requested.',
      'hard ceiling on the task and review classes',
      'reviewInputDigest',
      'Assessment never derives approval',
    ],
  },
  {
    path: resolve(root, 'apps/www/src/content/docs/zh-cn/contribute/agents.md'),
    required: [
      '它不会挡住你明确要求的工作。',
      '任务类别和复核类别的硬上限',
      '输入 digest',
      '测评不会派生批准',
    ],
  },
];
for (const { path: projectionPath, required } of bilingualAgentSemantics) {
  const projection = readFileSync(projectionPath, 'utf8');
  for (const phrase of required) {
    if (!projection.includes(phrase)) {
      fail(projectionPath + ': mode/review semantics are missing: ' + phrase);
    }
  }
}

const agentPolicy = readFileSync(
  resolve(root, 'internal/agent-operations/capability-policy.yaml'),
  'utf8'
);
if (
  !agentPolicy.includes('maximumBand: C4') ||
  !agentPolicy.includes('grantsPermission: false') ||
  !agentPolicy.includes('humanAssistedEffect: advisory-only') ||
  !agentPolicy.includes('autonomousEffect: binding-task-and-review-ceiling')
) {
  fail('capability policy must distinguish advisory collaboration from autonomous ceilings.');
}
try {
  const parsedPolicy = loadCapabilityPolicy(
    resolve(root, 'internal/agent-operations/capability-policy.yaml')
  );
  const scheduledReviewAuthorization = parsedPolicy.reviewSubmissionAuthorizations?.find(
    (authorization) => authorization.id === 'proto-ui-scheduled-review-v1'
  );
  const scheduledMergeAuthorization = parsedPolicy.pullRequestMergeAuthorizations?.find(
    (authorization) => authorization.id === 'proto-ui-scheduled-merge-v1'
  );
  if (
    parsedPolicy.bands?.C1?.minimumDimensionScore !== 1 ||
    !parsedPolicy.bands?.C1?.taskClasses?.includes('review-local') ||
    !parsedPolicy.bands?.C2?.taskClasses?.includes('release-own-claim') ||
    !parsedPolicy.bands?.C2?.taskClasses?.includes('update-tracked-maintenance-state') ||
    parsedPolicy.reviewClasses?.['review-facts-and-ci']?.autonomousMinimumBand !== 'C1' ||
    parsedPolicy.reviewClasses?.['review-bounded-regression']?.autonomousMinimumBand !== 'C2' ||
    parsedPolicy.reviewClasses?.['review-governance-and-release-evidence']
      ?.autonomousMinimumBand !== 'C4' ||
    parsedPolicy.mutationClasses?.['conditional-review-submission']?.externalWrite !== true ||
    parsedPolicy.mutationClasses?.['conditional-review-submission']?.autonomousMinimumBand !==
      'C4' ||
    parsedPolicy.mutationClasses?.['conditional-pull-request-merge']?.externalWrite !== true ||
    parsedPolicy.mutationClasses?.['conditional-pull-request-merge']?.autonomousMinimumBand !==
      'C4' ||
    scheduledReviewAuthorization?.status !== 'active' ||
    scheduledReviewAuthorization?.executionModeSource !== 'schedule' ||
    scheduledReviewAuthorization?.repositoryId !== 'github.com:Proto-UI/Proto-UI' ||
    scheduledReviewAuthorization?.mutationClass !== 'conditional-review-submission' ||
    !['REQUEST_CHANGES', 'APPROVE'].every((action) =>
      scheduledReviewAuthorization?.allowedRecommendations?.includes(action)
    ) ||
    scheduledMergeAuthorization?.status !== 'active' ||
    scheduledMergeAuthorization?.executionModeSource !== 'schedule' ||
    scheduledMergeAuthorization?.repositoryId !== 'github.com:Proto-UI/Proto-UI' ||
    scheduledMergeAuthorization?.mutationClass !== 'conditional-pull-request-merge' ||
    scheduledMergeAuthorization?.baseRefName !== 'main' ||
    scheduledMergeAuthorization?.mergeMethod !== 'squash' ||
    !parsedPolicy.bands?.C4?.taskClasses?.includes('integrate-approved-pull-request') ||
    parsedPolicy.trustedCiEvidence?.source !== 'github-actions' ||
    !parsedPolicy.trustedCiEvidence?.workflowNames?.includes('CI') ||
    !parsedPolicy.trustedCiEvidence?.workflowPaths?.includes('.github/workflows/ci.yml') ||
    !parsedPolicy.trustedCiEvidence?.checkNames?.includes('test') ||
    ![
      'finding-disposition',
      'semantic-admission',
      'ownership-decision',
      'scope-or-compatibility-tradeoff',
      'pull-request-approval',
      'merge',
      'publication',
      'release',
      'access-or-secret-change',
      'branch-or-ruleset-change',
    ].every((gate) => parsedPolicy.alwaysHuman?.includes(gate))
  ) {
    fail(
      'capability policy must cover review ceilings, governed C2 transitions, and always-human gates.'
    );
  }
} catch (error) {
  fail('capability policy is not executable: ' + error.message);
}

for (const schemaName of [
  'skill-handoff.schema.json',
  'capability-challenge.schema.json',
  'capability-response.schema.json',
  'capability-self-result.schema.json',
  'review-input.schema.json',
  'review-packet.schema.json',
]) {
  JSON.parse(readFileSync(resolve(root, 'internal/agent-operations/schemas', schemaName), 'utf8'));
}

const challenge = JSON.parse(
  execFileSync(
    process.execPath,
    [resolve(root, 'scripts/agent-operations/create-capability-challenge.mjs'), '--minutes', '5'],
    { cwd: root, encoding: 'utf8' }
  )
);
try {
  validateChallenge(challenge);
} catch (error) {
  fail('capability assessment artifact validation failed: ' + error.message);
}
if (
  challenge.kind !== 'proto-ui.agent-capability-challenge' ||
  challenge.questions?.length < 6 ||
  challenge.responseContract?.selfAssessmentCeiling !== 'C4' ||
  challenge.responseContract?.externalEvaluationRequired !== false
) {
  fail('capability challenge generator returned an invalid contract.');
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write('[contributor-skills] ' + failure + '\n');
  process.exitCode = 1;
} else {
  process.stdout.write(
    '[contributor-skills] OK: ' +
      skillNames.length +
      ' skills, ' +
      registryIds.length +
      ' lazy leaves\n'
  );
}
