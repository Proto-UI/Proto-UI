/** Discovery-only record schemas; they do not extend calibration/model-result admission. */
import { validate, validateMeasurements } from './schemas.mjs';

const text = { type: 'string', minLength: 1 };
const id = { type: 'string', pattern: '^[a-zA-Z0-9][a-zA-Z0-9._:#/-]*$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const number = { type: 'number', minimum: 0 };
const integer = { type: 'integer', minimum: 0 };
const array = (items, minItems = 0) => ({ type: 'array', items, minItems });
const nullable = (value) => ({ anyOf: [value, { type: 'null' }] });
const object = (properties) => ({
  type: 'object', additionalProperties: false, required: Object.keys(properties), properties,
});
const choice = (...values) => ({ enum: values });
const metric = (value) => object({ value: nullable(value), unavailableReason: nullable(text) });
export const fileReference = object({ path: text, sha256: digest });
const citation = object({ origin: choice('input', 'frozen-source'), file: fileReference, startLine: { type: 'integer', minimum: 1 }, endLine: { type: 'integer', minimum: 1 } });
export const discoveryCategories = [
  'both', 'agent-only-valid', 'proto-only', 'semantically-equivalent',
  'missing-from-proto', 'ambiguous-disputed', 'unsupported-false',
];
export const discoveryDimensions = [
  'behavior', 'keyboard', 'focus', 'dismissal', 'presence', 'cleanup',
  'stale-event-dispatch', 'accessibility', 'host',
];
const sourceFile = object({ path: text, sha256: digest, role: choice('catalog', 'contract', 'implementation', 'test', 'benchmark') });
const reference = object({ id, entityId: id, path: text, lifecycle: choice('draft', 'active', 'deprecated', 'removed'), criterionId: id });
const primitive = object({
  caseId: id, taskVariant: text, prompt: fileReference, parentCase: fileReference,
  rootEntity: id, lifecycle: choice('draft', 'active', 'deprecated', 'removed'),
  rationale: text, limits: array(text, 1), references: array(reference, 1),
});
const participant = object({
  provider: text, modelId: text, modelSnapshot: text,
  modelReleaseDate: metric(text), reasoning: text, sampling: text,
  context: text, tools: text, seed: metric(text),
});
const setup = object({
  id, modelClass: choice('frontier', 'mainstream', 'lower-cost-fast'), participant,
  harness: fileReference, retrievalBoundary: text, toolAccess: array(text),
  timeLimitSeconds: number, tokenLimit: metric(integer), computeLimitSeconds: metric(number),
});
const cell = object({
  id, caseId: id, setupId: id, condition: choice('blind', 'knowledge-visible'),
  repeat: { type: 'integer', minimum: 1 },
});
const run = object({
  id, cell, participantId: id,
  status: choice('completed', 'failed', 'excluded', 'deviating', 'unstarted'),
  reason: nullable(text), startedAt: nullable(text), finishedAt: nullable(text),
  transcript: nullable(fileReference), submission: nullable(fileReference),
  exposure: nullable(fileReference), review: nullable(fileReference),
  deviations: array(text),
  costs: object({ inputTokens: metric(integer), outputTokens: metric(integer), computeSeconds: metric(number), iterations: metric(integer) }),
});
const proposal = object({
  id, kind: choice('property', 'test'), statement: text, source: nullable(citation),
});
const row = object({
  id, category: choice(...discoveryCategories), proposalIds: array(id), referenceIds: array(id),
  dimensions: array(choice(...discoveryDimensions), 1), rationale: text,
  citations: array(citation, 1), consequence: text,
  feedback: nullable(fileReference), missingSearch: nullable(fileReference),
});
const assessment = object({
  reviewerId: id, evidence: array(citation, 1),
  classification: choice('supported', 'weakened', 'inconclusive', 'falsified'),
  hypothesis: text, rationale: text, limitations: array(text, 1), confounders: array(text, 1),
});
export const discoverySchemas = {
  manifest: object({
    schemaVersion: { const: 1 }, id, datasetId: { const: 'interaction-benchmark-v0' },
    datasetVersion: text, scoringVersion: text,
    sourceRevision: { type: 'string', pattern: '^[a-f0-9]{40}$' },
    purpose: text, split: { const: 'public-development' },
    formalExecution: { const: 'disabled' }, heldOut: { const: 'absent-do-not-publish-here' },
    minimumIndependentRepeats: { const: 3 },
    sourceFiles: array(sourceFile, 1),
    participantPrompts: array(fileReference, 1),
    referenceDocuments: array(fileReference, 1),
    primitives: array(primitive, 1),
    limitations: array(text, 1), parentSourceKeys: array(text, 1),
  }),
  observations: object({
    schemaVersion: { const: 1 }, studyId: id, frozenStudySha256: digest,
    evidenceKind: choice('recorded-public-development', 'injected-control'),
    coordinatorId: id, runInventory: fileReference, registeredPlan: fileReference,
    setups: array(setup), runs: array(run),
    assessment: nullable(assessment), limitations: array(text, 1),
  }),
  plan: object({ schemaVersion: { const: 1 }, registeredAt: text, cells: array(cell) }),
  inventory: object({ schemaVersion: { const: 1 }, runIds: array(id), collectionMethod: text, completenessLimit: text }),
  submission: object({ schemaVersion: { const: 1 }, proposals: array(proposal) }),
  exposure: object({
    schemaVersion: { const: 1 }, runId: id, freshContext: { type: 'boolean' },
    priorOutputAccess: { type: 'boolean' }, contextEvidence: fileReference,
    delivered: array(fileReference, 1), accessed: array(fileReference),
    boundary: { const: 'public-development-no-verified-isolation' },
    leakageObservations: array(text),
  }),
  review: object({
    schemaVersion: { const: 1 }, runId: id, reviewerId: id,
    independenceEvidence: fileReference, extractionCompleteness: fileReference,
    referenceEligibility: array(object({ referenceId: id, eligible: { type: 'boolean' }, reason: text })),
    rows: array(row), limitations: array(text, 1),
  }),
};
export function validateDiscovery(kind, value) {
  if (!Object.hasOwn(discoverySchemas, kind)) throw new Error(`Unknown discovery document: ${kind}`);
  validate(discoverySchemas[kind], value);
  validateMeasurements(value);
  return value;
}
