/** Canonical JSON Schemas. `benchmark schemas` exports ordinary JSON, without code. */
const string = { type: 'string', minLength: 1 };
const strings = { type: 'array', items: string };
const id = { type: 'string', pattern: '^[a-z0-9][a-z0-9.-]*$' };
const sha = { type: 'string', pattern: '^[a-f0-9]{40}$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const number = { type: 'number', minimum: 0 };
const integer = { type: 'integer', minimum: 0 };
const nullable = (schema) => ({ anyOf: [schema, { type: 'null' }] });
const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const array = (items, minItems = 0) => ({ type: 'array', minItems, items });
const choice = (...values) => ({ enum: values });
export const dimensions = [
  'behavior',
  'keyboard',
  'focus',
  'accessibility',
  'lifecycle',
  'host',
  'cleanup',
];
export const statuses = [
  'pass',
  'fail',
  'untested',
  'unsupported',
  'blocked',
  'disputed',
  'ambiguous',
];
export const measurement = object({ value: {}, unavailableReason: nullable(string) });
const source = object({ repository: string, sha });
const material = object({ path: string, sha256: digest });
const layer = object({
  kind: choice('platform', 'independent-journey', 'proto'),
  status: choice(
    'calibration-only',
    'reviewed',
    'unreviewed',
    'unsupported',
    'disputed',
    'ambiguous'
  ),
  references: strings,
  note: string,
});
const dimension = choice(...dimensions);
const status = choice(...statuses);
const check = object({ id, dimension, status, reason: string, evidence: strings });
const schema = (name, definition) => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: `urn:proto-ui:interaction-benchmark:${name}:1`,
  ...definition,
});
export const schemas = {
  case: schema(
    'case',
    object({
      schemaVersion: { const: 1 },
      id,
      datasetId: id,
      split: choice('development', 'evaluation', 'held-out'),
      origin: choice('public-calibration', 'private-authoring'),
      taskClass: choice(
        'discovery',
        'implementation',
        'maintenance',
        'bug-repair',
        'port-projection',
        'stress',
        'declarative',
        'performance'
      ),
      semanticDomain: string,
      title: string,
      requirements: string,
      source,
      oracleRef: id,
      visibility: object({
        ordinary: array(material),
        knowledge: array(material),
        withheld: strings,
      }),
      oracleLayers: array(layer, 3),
      evidenceRequirements: array(
        choice(
          'artifact',
          'prompt',
          'manifest',
          'events',
          'checks',
          'screenshot',
          'trace',
          'dom',
          'accessibility'
        ),
        1
      ),
      exclusions: strings,
      limitations: strings,
    })
  ),
  dataset: schema(
    'dataset',
    object({
      schemaVersion: { const: 1 },
      id,
      version: string,
      status: choice('draft', 'frozen'),
      source,
      cases: array(string, 1),
      scoringPath: string,
      formalPolicy: object({
        minimumIndependentRepeats: { type: 'integer', minimum: 3 },
        frontierFirst: { const: true },
        freezeBeforeEvaluation: { const: true },
        requireIndependentOracleReview: { const: true },
      }),
      limitations: strings,
    })
  ),
  run: schema(
    'run',
    object({
      schemaVersion: { const: 1 },
      runId: id,
      startedAt: string,
      kind: choice('calibration-stub', 'model-evaluation'),
      source,
      dataset: object({ id, version: string, sha256: digest }),
      scoring: object({ version: string, sha256: digest, frozen: { type: 'boolean' } }),
      participant: object({
        kind: choice('handwritten-fixture', 'model'),
        provider: measurement,
        modelId: measurement,
        modelSnapshot: measurement,
        modelReleaseDate: measurement,
        reasoning: measurement,
        sampling: measurement,
        context: measurement,
        tools: measurement,
        seed: measurement,
        independentContext: measurement,
      }),
      harness: object({
        version: string,
        sourceDigest: digest,
        node: string,
        packageManager: measurement,
        toolchain: measurement,
        os: string,
        browser: measurement,
        runtime: string,
      }),
      plan: object({
        cases: array(id, 1),
        arms: array(choice('blind', 'knowledge'), 1),
        repeats: { type: 'integer', minimum: 1 },
        independence: string,
        repairBudget: integer,
        maxWallTimeSeconds: measurement,
        maxTokens: measurement,
        maxCost: measurement,
      }),
      exposure: object({
        boundary: choice('public-calibration-only', 'verified-external-isolation'),
        workspace: string,
        gitHistory: string,
        network: string,
        oracleAccess: string,
        audit: measurement,
      }),
      deviations: strings,
    })
  ),
  result: schema(
    'result',
    object({
      schemaVersion: { const: 1 },
      runId: id,
      caseId: id,
      arm: choice('blind', 'knowledge'),
      repeat: { type: 'integer', minimum: 1 },
      kind: { const: 'calibration-stub' },
      status,
      startedAt: string,
      finishedAt: string,
      promptSha256: digest,
      artifactSha256: digest,
      oracleRef: id,
      checks: array(check, 1),
      dimensions: object(
        Object.fromEntries(
          dimensions.map((key) => [
            key,
            object({ status, passed: integer, failed: integer, other: integer }),
          ])
        )
      ),
      metrics: object({
        requirementRecall: measurement,
        falseRequirements: measurement,
        discoveryCrosswalk: measurement,
        firstPassCorrectness: measurement,
        finalCorrectness: measurement,
        repairCycles: integer,
        convergence: measurement,
        tokens: measurement,
        compute: measurement,
        wallTimeMs: number,
        humanWork: measurement,
      }),
      failures: array(object({ stage: string, message: string })),
      exclusions: strings,
      deviations: strings,
    })
  ),
};

// A deliberately small validator for the keywords used by the schemas above.
// Fail on unknown keywords rather than silently accepting an unimplemented schema.
const supported = new Set([
  '$schema',
  '$id',
  'type',
  'properties',
  'required',
  'additionalProperties',
  'items',
  'minItems',
  'minLength',
  'minimum',
  'pattern',
  'enum',
  'const',
  'anyOf',
]);
export function validate(schemaValue, value, path = '$') {
  for (const key of Object.keys(schemaValue))
    if (!supported.has(key)) throw new Error(`Unsupported schema keyword ${key}`);
  const fail = (message) => {
    throw new Error(`${path}: ${message}`);
  };
  if (schemaValue.anyOf) {
    if (
      !schemaValue.anyOf.some((candidate) => {
        try {
          validate(candidate, value, path);
          return true;
        } catch {
          return false;
        }
      })
    )
      fail('does not match any allowed type');
    return;
  }
  if ('const' in schemaValue && value !== schemaValue.const)
    fail(`must equal ${schemaValue.const}`);
  if (schemaValue.enum && !schemaValue.enum.includes(value))
    fail(`must be one of ${schemaValue.enum.join(', ')}`);
  const type = schemaValue.type;
  if (type === 'null' && value !== null) fail('must be null');
  if (type === 'object' && (value === null || typeof value !== 'object' || Array.isArray(value)))
    fail('must be an object');
  if (type === 'array' && !Array.isArray(value)) fail('must be an array');
  if (type === 'string' && typeof value !== 'string') fail('must be a string');
  if (type === 'boolean' && typeof value !== 'boolean') fail('must be boolean');
  if (
    (type === 'integer' || type === 'number') &&
    (typeof value !== 'number' ||
      !Number.isFinite(value) ||
      (type === 'integer' && !Number.isInteger(value)))
  )
    fail(`must be a finite ${type}`);
  if (type === 'object') {
    for (const key of schemaValue.required ?? [])
      if (!Object.hasOwn(value, key)) fail(`missing ${key}`);
    for (const [key, child] of Object.entries(value)) {
      if (!Object.hasOwn(schemaValue.properties ?? {}, key)) {
        if (schemaValue.additionalProperties === false) fail(`unexpected ${key}`);
      } else validate(schemaValue.properties[key], child, `${path}.${key}`);
    }
  }
  if (type === 'array') {
    if (value.length < (schemaValue.minItems ?? 0)) fail('too few items');
    value.forEach((item, index) => validate(schemaValue.items ?? {}, item, `${path}[${index}]`));
  }
  if (type === 'string') {
    if (value.length < (schemaValue.minLength ?? 0)) fail('empty string');
    if (schemaValue.pattern && !new RegExp(schemaValue.pattern).test(value)) fail('invalid format');
  }
  if (schemaValue.minimum !== undefined && value < schemaValue.minimum)
    fail(`must be >= ${schemaValue.minimum}`);
}
export function validateMeasurements(value, path = '$') {
  if (!value || typeof value !== 'object') return;
  if (Object.hasOwn(value, 'unavailableReason')) {
    if (
      value.value === null
        ? typeof value.unavailableReason !== 'string' || !value.unavailableReason.trim()
        : value.unavailableReason !== null
    )
      throw new Error(
        `${path}: unavailable values require a reason; available values require null reason`
      );
  }
  for (const [key, child] of Object.entries(value)) validateMeasurements(child, `${path}.${key}`);
}
export function validateDocument(kind, value) {
  if (!schemas[kind]) throw new Error(`Unknown document kind: ${kind}`);
  validate(schemas[kind], value);
  validateMeasurements(value);
  if (kind === 'case') {
    if (value.origin === 'public-calibration' && value.split !== 'development')
      throw new Error('Public calibration material cannot become evaluation or held-out');
    const layers = value.oracleLayers.map((layerValue) => layerValue.kind);
    if (layers.length !== 3 || new Set(layers).size !== 3)
      throw new Error('Exactly three distinct oracle layers required');
  }
  if (kind === 'run' && value.kind === 'model-evaluation') {
    if (
      !value.scoring.frozen ||
      value.plan.repeats < 3 ||
      value.participant.kind !== 'model' ||
      value.exposure.boundary !== 'verified-external-isolation'
    )
      throw new Error(
        'Formal runs require frozen scoring, >=3 independent repetitions, model identity, and verified external isolation'
      );
  }
  if (kind === 'result') {
    if (new Set(value.checks.map((checkValue) => checkValue.id)).size !== value.checks.length)
      throw new Error('Duplicate check IDs');
    const expected = summarizeChecks(value.checks);
    if (JSON.stringify(expected) !== JSON.stringify(value.dimensions))
      throw new Error('Dimension aggregates differ from raw checks');
    if (value.status !== outcomeStatus(value.checks))
      throw new Error('Result status differs from raw checks');
  }
  return value;
}
export function outcomeStatus(checks) {
  return (
    ['fail', 'blocked', 'disputed', 'ambiguous', 'untested', 'unsupported'].find((status) =>
      checks.some((check) => check.status === status)
    ) ?? (checks.length ? 'pass' : 'untested')
  );
}
export function summarizeChecks(checks) {
  return Object.fromEntries(
    dimensions.map((name) => {
      const rows = checks.filter((check) => check.dimension === name);
      return [
        name,
        {
          status: outcomeStatus(rows),
          passed: rows.filter((row) => row.status === 'pass').length,
          failed: rows.filter((row) => row.status === 'fail').length,
          other: rows.filter((row) => !['pass', 'fail'].includes(row.status)).length,
        },
      ];
    })
  );
}
export const measured = (value) => ({ value, unavailableReason: null });
export const unavailable = (unavailableReason) => ({ value: null, unavailableReason });
