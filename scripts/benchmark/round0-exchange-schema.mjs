import { validate } from './schemas.mjs';

// A separate protocol: none of these documents is a benchmark run or model result.
export const exchangeScope = 'public-development-contract-only';
export const limits = Object.freeze({
  files: 32,
  fileBytes: 1024 * 1024,
  totalBytes: 8 * 1024 * 1024,
  documentBytes: 65536,
});
const object = (properties) => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
});
const constant = (value) => ({ const: value });
const id = { type: 'string', pattern: '^[a-z0-9][a-z0-9-]{0,63}$' };
const digest = { type: 'string', pattern: '^[a-f0-9]{64}$' };
const source = object({
  repository: { type: 'string', pattern: '^https://github\\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$' },
  revision: { type: 'string', pattern: '^[a-f0-9]{40}$' },
  inventorySha256: digest,
});
const file = object({
  path: { type: 'string', minLength: 1 },
  bytes: { type: 'integer', minimum: 0 },
  sha256: digest,
});
const base = (kind) => ({
  schemaVersion: constant(1),
  kind: constant(`proto-ui.round0.${kind}`),
  scope: constant(exchangeScope),
});
const packetBinding = object({ packetId: id, receiptSha256: digest });
export const exchangeSchemas = {
  packet: object({
    ...base('packet'),
    packetId: id,
    source,
    files: { type: 'array', minItems: 1, items: file },
  }),
  submission: object({
    ...base('submission'),
    submissionId: id,
    attemptId: id,
    packet: packetBinding,
    source,
    participant: constant('synthetic'),
    outcome: { enum: ['completed', 'failed', 'aborted', 'excluded'] },
    files: { type: 'array', minItems: 1, items: file },
  }),
  expected: object({
    ...base('expected-submission'),
    submissionId: id,
    attemptId: id,
    packet: packetBinding,
    source,
  }),
  disposition: object({
    ...base('disposition'),
    outcome: { enum: ['failed', 'aborted', 'excluded'] },
    code: { enum: ['synthetic-failure', 'synthetic-interruption', 'synthetic-exclusion'] },
    reason: { type: 'string', minLength: 1 },
  }),
};

export function validateExchange(kind, value) {
  if (!Object.hasOwn(exchangeSchemas, kind)) throw new Error('Unknown exchange document kind');
  // Bound arrays before the generic validator walks them.
  if (
    value?.files !== undefined &&
    (!Array.isArray(value.files) || value.files.length > limits.files)
  )
    throw new Error(`File inventory must have at most ${limits.files} entries`);
  validate(exchangeSchemas[kind], value);
  if (kind === 'disposition') {
    const code = {
      failed: 'synthetic-failure',
      aborted: 'synthetic-interruption',
      excluded: 'synthetic-exclusion',
    }[value.outcome];
    if (value.code !== code || value.reason.length > 4096 || !value.reason.trim())
      throw new Error('Disposition code/reason does not match its outcome');
  }
  if (!value.files) return value;
  let total = 0;
  const paths = new Set();
  for (const item of value.files) {
    const permitted =
      kind === 'packet'
        ? /^(task\.txt|material-[1-9][0-9]?\.txt)$/.test(item.path)
        : /^(candidate\/[A-Za-z0-9][A-Za-z0-9._-]{0,79}|evidence\/(producer\.log|disposition\.json))$/.test(
            item.path
          );
    if (!permitted || paths.has(item.path))
      throw new Error('Unsafe, undeclared-kind or duplicate inventory path');
    paths.add(item.path);
    if (item.bytes > limits.fileBytes) throw new Error('File byte limit exceeded');
    total += item.bytes;
  }
  if (total > limits.totalBytes) throw new Error('Total byte limit exceeded');
  if (kind === 'packet' && !paths.has('task.txt')) throw new Error('Packet requires task.txt');
  if (kind === 'packet' && value.files.find((item) => item.path === 'task.txt').bytes === 0)
    throw new Error('Packet requires nonempty task bytes');
  if (kind === 'submission') {
    if (
      !paths.has('evidence/producer.log') ||
      value.files.find((f) => f.path === 'evidence/producer.log').bytes === 0
    )
      throw new Error('Submission requires a nonempty raw synthetic producer log');
    if (
      value.outcome === 'completed' &&
      !value.files.some((f) => f.path.startsWith('candidate/') && f.bytes > 0)
    )
      throw new Error('Completed submission requires a nonempty candidate artifact');
    if (paths.has('evidence/disposition.json') !== (value.outcome !== 'completed'))
      throw new Error(
        'Failure, abort and exclusion require a disposition; completion cannot carry one'
      );
  }
  return value;
}
