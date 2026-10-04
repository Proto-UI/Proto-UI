import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { loadSkillRegistry, REPEATABLE_HANDOFF_ARTIFACTS } from './skill-registry.mjs';

const root = new URL('../../', import.meta.url);
const path = new URL('internal/agent-operations/schemas/skill-handoff.schema.json', root);
const legacy = JSON.parse(
  fs.readFileSync(
    new URL('internal/agent-operations/schemas/skill-handoff-v1.schema.json', root),
    'utf8'
  )
);
delete legacy.$schema;
delete legacy.$id;
const registry = loadSkillRegistry();
const types = [
  ...new Set(
    registry.skills
      .flatMap((skill) => [
        ...skill.requires,
        ...skill.produces,
        ...(skill.conditionalProduces ?? []).map((x) => x.artifact),
      ])
      .concat(['interruption-receipt', 'prior-review-input', 'standing-user-authorization'])
  ),
].sort();
const repeatable = REPEATABLE_HANDOFF_ARTIFACTS;
const text = (maxLength = 1000) => ({ type: 'string', minLength: 1, maxLength });
const sha = { type: 'string', pattern: '^[a-f0-9]{40}$' };
const inputDigest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const pending = { type: 'array', uniqueItems: true, items: text() };
const v2 = structuredClone(legacy);
v2.properties.schemaVersion = { const: 2 };
v2.required.push('outcome', 'binding');
v2.properties.outcome = { enum: ['completed', 'interrupted'] };
v2.properties.binding = {
  type: 'object',
  additionalProperties: false,
  required: ['repositoryId', 'scopeId', 'headSha', 'reviewInputDigest'],
  properties: {
    repositoryId: { type: 'string', pattern: String.raw`^github\.com:[^/\s]+/[^/\s]+$` },
    scopeId: text(120),
    headSha: sha,
    reviewInputDigest: { anyOf: [inputDigest, { type: 'null' }] },
  },
};
v2.properties.artifacts.items.properties.type = { enum: types };
Object.assign(v2.properties.artifacts.items.properties, {
  scopeId: text(120),
  repositoryId: v2.properties.binding.properties.repositoryId,
  revision: sha,
  result: { enum: ['passed', 'failed', 'not-run', 'partial'] },
});
v2.properties.interruption = {
  type: 'object',
  additionalProperties: false,
  required: ['reason', 'pendingScope', 'pendingFindingIds', 'resumeSkillId'],
  properties: {
    reason: text(2000),
    pendingScope: { ...pending, minItems: 1 },
    pendingFindingIds: pending,
    resumeSkillId: { type: 'string', pattern: '^pui-[a-z0-9-]+$' },
  },
};
v2.properties.resume = {
  type: 'object',
  additionalProperties: false,
  required: [
    'interruptedHandoffReference',
    'interruptedHandoffDigest',
    'sourceSkillId',
    'previousHeadSha',
    'previousReviewInputDigest',
    'pendingScope',
    'pendingFindingIds',
  ],
  properties: {
    interruptedHandoffReference: text(),
    interruptedHandoffDigest: legacy.properties.artifacts.items.properties.digest,
    sourceSkillId: { type: 'string', pattern: '^pui-[a-z0-9-]+$' },
    previousHeadSha: sha,
    previousReviewInputDigest: inputDigest,
    pendingScope: { ...pending, minItems: 1 },
    pendingFindingIds: pending,
  },
};
v2.allOf = types
  .filter((type) => !repeatable.includes(type))
  .map((type) => ({
    properties: {
      artifacts: {
        contains: { type: 'object', properties: { type: { const: type } }, required: ['type'] },
        minContains: 0,
        maxContains: 1,
      },
    },
  }));
v2.allOf.push({
  if: { properties: { outcome: { const: 'interrupted' } } },
  then: {
    required: ['interruption'],
    properties: {
      resume: false,
      fromId: { const: 'pui-review' },
      nextSkillId: { enum: ['pui-ci', null] },
      binding: { properties: { reviewInputDigest: inputDigest } },
      artifacts: {
        contains: {
          type: 'object',
          required: ['type', 'digest', 'revision'],
          properties: {
            type: { const: 'review-input' },
            digest: legacy.properties.artifacts.items.properties.digest,
            revision: sha,
          },
        },
        minContains: 1,
        maxContains: 1,
      },
    },
  },
  else: { properties: { interruption: false } },
});
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://proto-ui.dev/schemas/skill-handoff.schema.json',
  title: 'Proto UI composable skill handoff',
  description:
    'V1 remains completed/singleton. V2 records completed or interrupted work. All registered types are singleton except candidate-change and evidence-report. Runtime additionally verifies type+reference uniqueness, common scope/repository equality, registered routing and source/destination requirements. These relational checks do not establish evidence or authorization.',
  oneOf: [legacy, v2],
};
const output = await format(JSON.stringify(schema), {
  ...(await resolveConfig(fileURLToPath(path))),
  parser: 'json',
});
if (process.argv.includes('--check')) {
  if (fs.readFileSync(path, 'utf8') !== output) throw Error('handoff schema projection is stale');
  console.log('Handoff schema projection is current');
} else {
  fs.writeFileSync(path, output);
  console.log('Handoff schema projection generated');
}
