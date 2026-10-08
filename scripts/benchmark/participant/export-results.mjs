import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

// A portable projection, not a replacement for the independently audited archive.
// Allowlisted fields only: no provider message attribution, credentials or raw logs.
const pick = (value, fields) =>
  Object.fromEntries(
    fields.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]])
  );
const usage = (value) =>
  value === null || value === undefined
    ? null
    : pick(value, [
        'input_tokens',
        'input_tokens_details',
        'output_tokens',
        'output_tokens_details',
        'total_tokens',
      ]);
const [sourcePath, targetPath] = process.argv.slice(2);
assert.ok(sourcePath && targetPath, 'Usage: node export-results.mjs ARCHIVED_RESULTS OUTPUT');
const sourceBytes = await readFile(sourcePath);
const source = JSON.parse(sourceBytes);
assert.equal(source.kind, 'interrupted-two-batch-exploratory-results');
assert.equal(source.participantAttempts, 10);
assert.equal(source.attempts.length, 10);
const projection = {
  projectionKind: 'portable-allowlisted-results-not-raw-evidence',
  sourceResultsSha256: createHash('sha256').update(sourceBytes).digest('hex'),
  ...pick(source, [
    'kind',
    'date',
    'originalLedgerSha256',
    'supplementLedgerSha256',
    'originalCoverage',
    'supplementCoverage',
    'participantAttempts',
    'scorable',
    'allPassed',
    'clientRetries',
    'knownUsageAttempts',
    'unknownUsageAttempts',
    'knownUsage',
    'referenceKnownUSD',
    'actualUSD',
    'byCondition',
    'limitations',
  ]),
  attempts: source.attempts.map((row) => ({
    ...pick(row, [
      'id',
      'batch',
      'block',
      'position',
      'condition',
      'requestSha256',
      'originalSlotId',
      'originalSlotOrdinal',
      'newAttemptOrdinal',
      'origin',
      'attempted',
      'dispatched',
      'receivingStatus',
      'scoringEligible',
      'newFeaturePassed',
      'newFeatureTotal',
      'regressionPassed',
      'regressionTotal',
      'corePassed',
      'coreTotal',
      'allPassed',
      'checks',
      'participantMs',
      'workerMs',
      'totalMs',
      'referenceUSD',
      'actualUSD',
      'error',
      'stopReason',
      'reportedSettings',
      'usageBasis',
      'referenceBasis',
      'actualBasis',
      'reportedSettingsConsistent',
    ]),
    usage: usage(row.usage),
  })),
  diagnostic: {
    ...pick(source.diagnostic, [
      'participantSample',
      'dispatches',
      'wallMs',
      'referenceUSD',
      'actualUSD',
    ]),
    usage: usage(source.diagnostic.usage),
  },
  evidenceAvailability: {
    rawEvidence: 'local-only; not included in Git',
    originalNotRunSlots: 5,
    originalFailurePreserved: true,
    fullCriteriaVectors: 'checks on each scorable attempt; failure remains unscorable',
    sourceArchiveUnmodified: true,
  },
};
await writeFile(targetPath, `${JSON.stringify(projection, null, 2)}\n`, { flag: 'wx' });
