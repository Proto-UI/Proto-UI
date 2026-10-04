import {
  ownerAuthorizationFromArgs,
  ownerAuthorizationAllows,
  ownerSkillEligibility,
} from './owner-authorization.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const DEFAULT_ROOT = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
const ID = /^pui-[a-z0-9-]+$/;
const ARTIFACT = /^[a-z][a-z0-9-]*$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const BAND_ORDER = ['U0', 'C1', 'C2', 'C3', 'C4'];
const ENTRYPOINTS = ['development', 'maintenance'];
const EXECUTION_MODES = ['human-assisted', 'autonomous'];
const MODE_SOURCES = {
  'human-assisted': new Set(['current-user', 'active-human-loop']),
  autonomous: new Set(['maintainer-invocation', 'schedule', 'governed-queue']),
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertExactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    JSON.stringify(actual) === JSON.stringify(wanted),
    `${label} has unexpected or missing fields`
  );
}

function assertStringList(value, label, { nonempty = false } = {}) {
  assert(Array.isArray(value), `${label} must be an array`);
  if (nonempty) assert(value.length > 0, `${label} must not be empty`);
  const seen = new Set();
  for (const item of value) {
    assert(
      typeof item === 'string' && ARTIFACT.test(item),
      `${label} contains an invalid artifact type`
    );
    assert(!seen.has(item), `${label} contains duplicate artifact type ${item}`);
    seen.add(item);
  }
}

function assertEntrypointList(value, label) {
  assert(Array.isArray(value) && value.length > 0, `${label} must be a non-empty array`);
  const seen = new Set();
  for (const entrypoint of value) {
    assert(
      ENTRYPOINTS.includes(entrypoint),
      `${label} contains an unknown entrypoint: ${entrypoint}`
    );
    assert(!seen.has(entrypoint), `${label} duplicates ${entrypoint}`);
    seen.add(entrypoint);
  }
}

function withinRoot(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}

export function validateSkillRegistryDocument(registry, policy, { root = DEFAULT_ROOT } = {}) {
  assertExactKeys(
    registry,
    ['schemaVersion', 'registryVersion', 'entrypoints', 'compositionRules', 'skills'],
    'registry'
  );
  assert(registry.schemaVersion === 2, 'registry.schemaVersion must be 2');
  assert(
    typeof registry.registryVersion === 'string' && registry.registryVersion.length > 0,
    'registry.registryVersion must be a non-empty string'
  );
  assertExactKeys(registry.entrypoints, ENTRYPOINTS, 'registry.entrypoints');
  const entrypointIds = new Set(Object.values(registry.entrypoints));
  for (const id of entrypointIds) assert(ID.test(id), `invalid entrypoint id ${id}`);
  assert(entrypointIds.size === 2, 'entrypoint ids must be unique');
  assert(
    Array.isArray(registry.compositionRules) && registry.compositionRules.length > 0,
    'registry.compositionRules must not be empty'
  );
  assert(
    Array.isArray(registry.skills) && registry.skills.length > 0,
    'registry.skills must not be empty'
  );

  assert(policy && typeof policy === 'object', 'capability policy must be an object');
  const policyBands = policy.bands ?? {};
  for (const band of BAND_ORDER)
    assert(policyBands[band], `capability policy is missing band ${band}`);
  const taskClassBands = new Map();
  for (const band of BAND_ORDER) {
    for (const taskClass of policyBands[band].taskClasses ?? []) {
      assert(
        !taskClassBands.has(taskClass),
        `capability policy duplicates task class ${taskClass}`
      );
      taskClassBands.set(taskClass, band);
    }
  }

  const ids = new Set();
  const loadPaths = new Set();
  for (const [index, skill] of registry.skills.entries()) {
    const label = `registry.skills[${index}]`;
    assertExactKeys(
      skill,
      [
        'id',
        'entrypoints',
        'loadPath',
        'transition',
        'autonomousMinimumBand',
        'taskClass',
        'mutation',
        'requires',
        'produces',
        ...(Object.hasOwn(skill, 'conditionalProduces') ? ['conditionalProduces'] : []),
        ...(Object.hasOwn(skill, 'interruptions') ? ['interruptions'] : []),
      ],
      label
    );
    assert(ID.test(skill.id), `${label}.id is invalid`);
    assertEntrypointList(skill.entrypoints, `${label}.entrypoints`);
    assert(!entrypointIds.has(skill.id), `${label}.id must be a leaf, not an entrypoint`);
    assert(!ids.has(skill.id), `${label}.id duplicates ${skill.id}`);
    ids.add(skill.id);
    assert(
      typeof skill.loadPath === 'string' && skill.loadPath.length > 0,
      `${label}.loadPath is invalid`
    );
    assert(
      !path.isAbsolute(skill.loadPath) && !skill.loadPath.split('/').includes('..'),
      `${label}.loadPath must be repository-relative`
    );
    assert(!loadPaths.has(skill.loadPath), `${label}.loadPath duplicates ${skill.loadPath}`);
    loadPaths.add(skill.loadPath);
    const absoluteLoadPath = path.resolve(root, skill.loadPath);
    assert(withinRoot(root, absoluteLoadPath), `${label}.loadPath escapes the repository`);
    assert(fs.existsSync(absoluteLoadPath), `${label}.loadPath does not exist: ${skill.loadPath}`);
    assert(
      skill.loadPath.replaceAll('\\', '/') === `.agents/skills/${skill.id}/SKILL.md`,
      `${label}.loadPath must address its own SKILL.md`
    );
    const skillSource = fs.readFileSync(absoluteLoadPath, 'utf8');
    assert(
      skillSource.match(/^name:\s*(.+)$/m)?.[1] === skill.id,
      `${label}.loadPath frontmatter name does not match id`
    );
    assert(
      typeof skill.transition === 'string' && skill.transition.includes('->'),
      `${label}.transition must describe one state change`
    );
    assert(
      BAND_ORDER.includes(skill.autonomousMinimumBand),
      `${label}.autonomousMinimumBand is not defined by policy`
    );
    const taskBand = taskClassBands.get(skill.taskClass);
    assert(taskBand, `${label}.taskClass is not defined by capability policy`);
    assert(
      BAND_ORDER.indexOf(skill.autonomousMinimumBand) >= BAND_ORDER.indexOf(taskBand),
      `${label}.autonomousMinimumBand cannot be lower than task class ${skill.taskClass}`
    );
    const mutationBand = policy.mutationClasses?.[skill.mutation]?.autonomousMinimumBand;
    assert(mutationBand, `${label}.mutation is not a policy mutation class`);
    assert(BAND_ORDER.includes(mutationBand), `${label}.mutation autonomousMinimumBand is invalid`);
    assert(
      BAND_ORDER.indexOf(skill.autonomousMinimumBand) >= BAND_ORDER.indexOf(mutationBand),
      `${label}.autonomousMinimumBand is below mutation class ${skill.mutation}`
    );
    assertStringList(skill.requires, `${label}.requires`, { nonempty: true });
    assertStringList(skill.produces, `${label}.produces`, { nonempty: true });
    if (Object.hasOwn(skill, 'conditionalProduces')) {
      assert(
        Array.isArray(skill.conditionalProduces) && skill.conditionalProduces.length > 0,
        `${label}.conditionalProduces must be a non-empty array`
      );
      const conditions = new Set();
      for (const condition of skill.conditionalProduces) {
        assertExactKeys(
          condition,
          ['whenHumanGate', 'artifact'],
          `${label}.conditionalProduces item`
        );
        assert(
          policy.attendedDecisionClasses.includes(condition.whenHumanGate),
          `${label}.conditionalProduces names an unknown attended decision`
        );
        assertStringList([condition.artifact], `${label}.conditionalProduces artifact`);
        const key = `${condition.whenHumanGate}:${condition.artifact}`;
        assert(!conditions.has(key), `${label}.conditionalProduces duplicates a condition`);
        assert(
          !skill.produces.includes(condition.artifact),
          `${label}.conditionalProduces duplicates an unconditional output`
        );
        conditions.add(key);
      }
    }
  }

  for (const skill of registry.skills) {
    if (skill.interruptions) {
      assertExactKeys(skill.interruptions, ['destinations', 'terminal'], 'skill interruptions');
      assert(
        typeof skill.interruptions.terminal === 'boolean',
        'interruption terminal flag is invalid'
      );
      assert(
        Array.isArray(skill.interruptions.destinations) &&
          new Set(skill.interruptions.destinations).size ===
            skill.interruptions.destinations.length,
        'interruption routes are invalid'
      );
      for (const destination of skill.interruptions.destinations) {
        const target = registry.skills.find((entry) => entry.id === destination);
        assert(
          target && target.id !== skill.id && target.mutation === 'none',
          'interruption route must be read-only and non-recursive'
        );
      }
    }
  }
  return {
    ...registry,
    byId: new Map(registry.skills.map((skill) => [skill.id, Object.freeze({ ...skill })])),
    entrypointIds,
    humanGates: new Set(policy.attendedDecisionClasses ?? []),
  };
}

export function loadSkillRegistry({ root = DEFAULT_ROOT } = {}) {
  const registryPath = path.resolve(root, 'internal/agent-operations/skills.yaml');
  const policyPath = path.resolve(root, 'internal/agent-operations/capability-policy.yaml');
  const registry = YAML.parse(fs.readFileSync(registryPath, 'utf8'));
  const policy = YAML.parse(fs.readFileSync(policyPath, 'utf8'));
  return validateSkillRegistryDocument(registry, policy, { root });
}

function validateArtifact(artifact, index, handoff) {
  const allowed =
    artifact && typeof artifact === 'object' && !Array.isArray(artifact)
      ? Object.keys(artifact).every((key) =>
          [
            'type',
            'reference',
            'digest',
            ...(handoff.schemaVersion === 2
              ? ['scopeId', 'repositoryId', 'revision', 'result']
              : []),
          ].includes(key)
        )
      : false;
  assert(allowed, `handoff.artifacts[${index}] has an invalid shape`);
  assert(ARTIFACT.test(artifact.type ?? ''), `handoff.artifacts[${index}].type is invalid`);
  assert(
    typeof artifact.reference === 'string' &&
      artifact.reference.length > 0 &&
      artifact.reference.length <= 1000,
    `handoff.artifacts[${index}].reference is invalid`
  );
  if (artifact.digest !== undefined)
    assert(DIGEST.test(artifact.digest), `handoff.artifacts[${index}].digest is invalid`);
}

export const REPEATABLE_HANDOFF_ARTIFACTS = Object.freeze(['candidate-change', 'evidence-report']);
export function getHandoffArtifacts(handoff, type) {
  return handoff.artifacts.filter((artifact) => artifact.type === type);
}
export function requireCompletedHandoff(handoff) {
  assert(
    handoff.outcome !== 'interrupted',
    'interrupted handoff cannot supply completed review or mutation evidence'
  );
  return handoff;
}
function validateHandoffV2State(handoff, registry) {
  assert(['completed', 'interrupted'].includes(handoff.outcome), 'handoff outcome is invalid');
  assertExactKeys(
    handoff.binding,
    ['repositoryId', 'scopeId', 'headSha', 'reviewInputDigest'],
    'handoff.binding'
  );
  assert(
    typeof handoff.binding.repositoryId === 'string' &&
      handoff.binding.repositoryId.startsWith('github.com:') &&
      handoff.binding.repositoryId.split('/').length === 2 &&
      handoff.binding.repositoryId.split('/')[0].length > 11 &&
      handoff.binding.repositoryId.split('/')[1].length > 0 &&
      !/\s/.test(handoff.binding.repositoryId),
    'invalid repository binding'
  );
  assert(
    typeof handoff.binding.scopeId === 'string' &&
      handoff.binding.scopeId.length > 0 &&
      handoff.binding.scopeId.length <= 120,
    'invalid scope binding'
  );
  assert(/^[a-f0-9]{40}$/.test(handoff.binding.headSha), 'invalid head binding');
  assert(
    handoff.binding.reviewInputDigest === null ||
      /^[a-f0-9]{64}$/.test(handoff.binding.reviewInputDigest),
    'invalid input binding'
  );
  if (handoff.outcome === 'interrupted') {
    const source = registry.byId.get(handoff.fromId);
    assert(source?.interruptions, 'source leaf does not admit interruption');
    assertExactKeys(
      handoff.interruption,
      ['reason', 'pendingScope', 'pendingFindingIds', 'resumeSkillId'],
      'handoff.interruption'
    );
    assert(
      typeof handoff.interruption.reason === 'string' &&
        handoff.interruption.reason.length > 0 &&
        handoff.interruption.reason.length <= 2000,
      'invalid interruption reason'
    );
    for (const key of ['pendingScope', 'pendingFindingIds']) {
      const values = handoff.interruption[key];
      assert(
        Array.isArray(values) &&
          values.every(
            (value) => typeof value === 'string' && value.length > 0 && value.length <= 1000
          ) &&
          new Set(values).size === values.length,
        'invalid pending work'
      );
    }
    assert(handoff.interruption.pendingScope.length > 0, 'unfinished scope is missing');
    assert(handoff.interruption.resumeSkillId === handoff.fromId, 'resume source differs');
    assert(
      handoff.binding.reviewInputDigest !== null,
      'interrupted review requires exact input binding'
    );
    const priorInputs = Array.isArray(handoff.artifacts)
      ? handoff.artifacts.filter((a) => a.type === 'review-input')
      : [];
    assert(
      priorInputs.length === 1 &&
        priorInputs[0].digest === 'sha256:' + handoff.binding.reviewInputDigest &&
        priorInputs[0].revision === handoff.binding.headSha,
      'interrupted review requires its bound prior input artifact'
    );
    if (handoff.nextSkillId === null)
      assert(source.interruptions.terminal === true, 'terminal interruption is not admitted');
    else {
      assert(
        source.interruptions.destinations.includes(handoff.nextSkillId),
        'interruption destination is not admitted'
      );
      assert(
        registry.byId.get(handoff.nextSkillId)?.mutation === 'none',
        'interruption cannot admit a mutation'
      );
    }
    assert(handoff.resume === undefined, 'interruption cannot also be a resume');
  } else {
    assert(
      handoff.interruption === undefined,
      'completed handoff cannot retain unfinished outcome'
    );
    if (handoff.resume !== undefined) {
      assertExactKeys(
        handoff.resume,
        [
          'interruptedHandoffReference',
          'interruptedHandoffDigest',
          'sourceSkillId',
          'previousHeadSha',
          'previousReviewInputDigest',
          'pendingScope',
          'pendingFindingIds',
        ],
        'handoff.resume'
      );
      assert(
        typeof handoff.resume.interruptedHandoffReference === 'string' &&
          handoff.resume.interruptedHandoffReference.length > 0 &&
          handoff.resume.interruptedHandoffReference.length <= 1000,
        'resume receipt reference is missing'
      );
      assert(
        DIGEST.test(handoff.resume.interruptedHandoffDigest),
        'resume receipt digest is invalid'
      );
      assert(
        handoff.nextSkillId === handoff.resume.sourceSkillId &&
          registry.byId.has(handoff.resume.sourceSkillId),
        'resume must return to original leaf'
      );
      assert(
        /^[a-f0-9]{40}$/.test(handoff.resume.previousHeadSha) &&
          /^[a-f0-9]{64}$/.test(handoff.resume.previousReviewInputDigest),
        'resume prior binding is invalid'
      );
      assert(
        Array.isArray(handoff.resume.pendingScope) &&
          handoff.resume.pendingScope.length > 0 &&
          Array.isArray(handoff.resume.pendingFindingIds),
        'resume pending work is missing'
      );
      for (const values of [handoff.resume.pendingScope, handoff.resume.pendingFindingIds]) {
        assert(
          values.every(
            (value) => typeof value === 'string' && value.length > 0 && value.length <= 1000
          ) && new Set(values).size === values.length,
          'resume pending work is invalid'
        );
      }
      assert(
        registry.byId.get(handoff.resume.sourceSkillId)?.interruptions,
        'resume source does not admit interruption'
      );
      assert(
        handoff.artifacts.some(
          (a) =>
            a.type === 'interruption-receipt' &&
            a.reference === handoff.resume.interruptedHandoffReference &&
            a.digest === handoff.resume.interruptedHandoffDigest
        ),
        'resume must retain its bound interruption receipt'
      );
      assert(
        handoff.artifacts.some(
          (a) =>
            a.type === 'review-input' &&
            a.digest === 'sha256:' + handoff.binding.reviewInputDigest &&
            a.revision === handoff.binding.headSha
        ),
        'resume input does not bind current head and digest'
      );
      assert(
        handoff.artifacts.some((a) => a.type === 'review-input') &&
          handoff.binding.reviewInputDigest !== null,
        'resume needs refreshed current input'
      );
    }
  }
}

export function validateSkillHandoff(handoff, registry = loadSkillRegistry()) {
  assertExactKeys(
    handoff,
    [
      'schemaVersion',
      'kind',
      'entrypoint',
      'executionMode',
      'executionModeSource',
      'fromId',
      'nextSkillId',
      'artifacts',
      'humanGates',
      'notes',
      ...(handoff?.schemaVersion === 2
        ? [
            'outcome',
            'binding',
            ...(Object.hasOwn(handoff, 'interruption') ? ['interruption'] : []),
            ...(Object.hasOwn(handoff, 'resume') ? ['resume'] : []),
          ]
        : []),
    ],
    'handoff'
  );
  assert([1, 2].includes(handoff.schemaVersion), 'handoff.schemaVersion must be 1 or 2');
  if (handoff.schemaVersion === 2) {
    validateHandoffV2State(handoff, registry);
    const kinds = new Set(
      registry.skills
        .flatMap((skill) => [
          ...skill.requires,
          ...skill.produces,
          ...(skill.conditionalProduces ?? []).map((value) => value.artifact),
        ])
        .concat(['interruption-receipt', 'prior-review-input', 'standing-user-authorization'])
    );
    assert(
      Array.isArray(handoff.artifacts) &&
        handoff.artifacts.every((artifact) => kinds.has(artifact?.type)),
      'handoff v2 contains an undeclared artifact kind'
    );
  }
  assert(handoff.kind === 'proto-ui.skill-handoff', 'handoff.kind is invalid');
  assert(Object.hasOwn(registry.entrypoints, handoff.entrypoint), 'handoff.entrypoint is invalid');
  assert(EXECUTION_MODES.includes(handoff.executionMode), 'handoff.executionMode is invalid');
  establishExecutionMode(handoff.executionMode, handoff.executionModeSource);
  assert(ID.test(handoff.fromId ?? ''), 'handoff.fromId is invalid');
  const fromLeaf = registry.byId.get(handoff.fromId);
  const expectedEntrypoint = registry.entrypoints[handoff.entrypoint];
  assert(
    fromLeaf || handoff.fromId === expectedEntrypoint,
    'handoff.fromId is not registered for this entrypoint'
  );
  if (fromLeaf) {
    assert(
      fromLeaf.entrypoints.includes(handoff.entrypoint),
      `handoff.entrypoint is not allowed by source leaf ${fromLeaf.id}`
    );
  }
  assert(
    handoff.nextSkillId === null || ID.test(handoff.nextSkillId ?? ''),
    'handoff.nextSkillId is invalid'
  );
  assert(
    Array.isArray(handoff.artifacts) && handoff.artifacts.length > 0,
    'handoff.artifacts must not be empty'
  );
  const artifactTypes = new Set();
  const artifactIdentities = new Set();
  handoff.artifacts.forEach((artifact, index) => {
    validateArtifact(artifact, index, handoff);
    const identity = artifact.type + '\u0000' + artifact.reference;
    assert(
      !artifactIdentities.has(identity),
      'handoff.artifacts duplicates type/reference identity ' + artifact.type
    );
    artifactIdentities.add(identity);
    if (handoff.schemaVersion === 2) {
      if (artifact.scopeId !== undefined)
        assert(artifact.scopeId === handoff.binding.scopeId, 'artifact scope mismatch');
      if (artifact.repositoryId !== undefined)
        assert(
          artifact.repositoryId === handoff.binding.repositoryId,
          'artifact repository mismatch'
        );
      if (artifact.revision !== undefined)
        assert(/^[a-f0-9]{40}$/.test(artifact.revision), 'artifact revision is invalid');
      if (artifact.result !== undefined)
        assert(
          ['passed', 'failed', 'not-run', 'partial'].includes(artifact.result),
          'artifact result is invalid'
        );
    }
    assert(
      (handoff.schemaVersion === 2 && REPEATABLE_HANDOFF_ARTIFACTS.includes(artifact.type)) ||
        !artifactTypes.has(artifact.type),
      'handoff.artifacts duplicates type ' + artifact.type
    );
    artifactTypes.add(artifact.type);
  });
  if (fromLeaf && handoff.outcome !== 'interrupted') {
    for (const produced of fromLeaf.produces) {
      assert(
        artifactTypes.has(produced),
        `handoff is missing artifact produced by ${fromLeaf.id}: ${produced}`
      );
    }
  }
  assert(Array.isArray(handoff.humanGates), 'handoff.humanGates must be an array');
  const gates = new Set();
  for (const gate of handoff.humanGates) {
    assert(
      typeof gate === 'string' && registry.humanGates.has(gate),
      `handoff.humanGates contains an unknown gate: ${gate}`
    );
    assert(!gates.has(gate), `handoff.humanGates duplicates ${gate}`);
    gates.add(gate);
  }
  for (const condition of fromLeaf?.conditionalProduces ?? []) {
    if (gates.has(condition.whenHumanGate)) {
      assert(
        artifactTypes.has(condition.artifact),
        `handoff is missing conditional artifact produced by ${fromLeaf.id}: ${condition.artifact}`
      );
    }
  }
  assert(Array.isArray(handoff.notes), 'handoff.notes must be an array');
  for (const note of handoff.notes)
    assert(
      typeof note === 'string' && note.length <= 1000,
      'handoff.notes contains an invalid note'
    );

  if (handoff.executionMode === 'autonomous' && gates.size > 0) {
    assert(
      handoff.nextSkillId === null,
      'autonomous handoff must stop when an attended decision is pending'
    );
  }

  if (handoff.nextSkillId === null) return { handoff, nextSkill: null };
  assert(
    handoff.nextSkillId !== handoff.fromId,
    'handoff cannot recursively select its source skill'
  );
  const nextSkill = registry.byId.get(handoff.nextSkillId);
  assert(nextSkill, `handoff.nextSkillId is not a registered leaf: ${handoff.nextSkillId}`);
  assert(
    nextSkill.entrypoints.includes(handoff.entrypoint),
    `handoff.entrypoint is not allowed by next leaf ${nextSkill.id}`
  );
  for (const required of nextSkill.requires) {
    assert(
      artifactTypes.has(required),
      `handoff lacks artifact required by ${nextSkill.id}: ${required}`
    );
  }
  return { handoff, nextSkill };
}

export function resolveSkill(id, registry = loadSkillRegistry()) {
  assert(ID.test(id ?? ''), 'skill id is invalid');
  assert(
    !registry.entrypointIds.has(id),
    'entrypoints route one leaf and cannot be loaded as leaves'
  );
  const skill = registry.byId.get(id);
  assert(skill, `unknown skill id: ${id}`);
  return skill;
}

export function establishExecutionMode(requestedMode, source) {
  assert(EXECUTION_MODES.includes(requestedMode), 'execution mode is invalid');
  assert(
    MODE_SOURCES[requestedMode].has(source),
    `execution mode ${requestedMode} cannot be established from ${source}`
  );
  return requestedMode;
}

export function evaluateSkillEligibility(
  skill,
  {
    executionMode,
    selfAssessment = null,
    ownerAuthorization = null,
    repositoryId = null,
    scopeId = null,
    executionModeSource = null,
    entrypoint = null,
  } = {}
) {
  assert(EXECUTION_MODES.includes(executionMode), 'execution mode is invalid');
  if (executionMode === 'human-assisted') {
    return {
      eligible: true,
      assessmentEffect: 'advisory',
      reason:
        'current human direction governs task choice; assessment calibrates review and evidence',
    };
  }
  const delegated = ownerSkillEligibility(skill, {
    ownerAuthorization,
    executionMode,
    repositoryId,
    scopeId,
    executionModeSource,
    entrypoint,
  });
  if (delegated) return delegated;
  if (['pui-orient', 'pui-assess'].includes(skill.id)) {
    return {
      eligible: true,
      assessmentEffect: 'bootstrap',
      reason: 'orientation and local assessment establish the autonomous ceiling',
    };
  }
  const band = selfAssessment?.capability?.band;
  const validKind = selfAssessment?.kind === 'proto-ui.agent-capability-self-result';
  const validated = selfAssessment?.validated === true;
  const fresh = selfAssessment?.fresh === true;
  if (!validKind || !validated || !fresh || !BAND_ORDER.includes(band)) {
    return {
      eligible: false,
      assessmentEffect: 'binding-ceiling',
      reason: 'autonomous work requires a fresh local self-assessment',
    };
  }
  const eligible =
    BAND_ORDER.indexOf(band) >= BAND_ORDER.indexOf(skill.autonomousMinimumBand) &&
    selfAssessment.capability.eligibleTaskClasses?.includes(skill.taskClass);
  return {
    eligible,
    assessmentEffect: 'binding-ceiling',
    reason: eligible
      ? 'skill is within the fresh self-assessed autonomous ceiling'
      : `skill exceeds the ${band} autonomous ceiling`,
  };
}

export const skillRegistryRoot = DEFAULT_ROOT;
