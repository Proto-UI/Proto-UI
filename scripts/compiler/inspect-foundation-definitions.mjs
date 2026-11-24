#!/usr/bin/env node
// Rebind the recovered definition inventory to an immutable public revision.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import { FOUNDATION_ANCHOR } from './verify-frozen-foundation.mjs';

const ledgerPath = 'internal/records/2026-11-22-sprint4-ir10-recovery.json';
// This is the published recovery inventory from #1714, not a caller-supplied
// replacement with the same number of definitions.
const ledgerSha256 = 'e88d7ddfd1ab523c23cd6c6402184023faed31abb30b9232c1f035361d42edcd';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

function readBlob(repository, revision, path) {
  return execFileSync('git', ['show', `${revision}:${path}`], {
    cwd: repository,
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

export function inspectFoundationDefinitions(repository, revision, inventoryRevision = revision) {
  for (const requested of new Set([revision, inventoryRevision])) {
    if (!/^[a-f0-9]{40}$/.test(requested))
      throw new Error('Expected a complete immutable Git commit SHA.');
    const actual = execFileSync('git', ['rev-parse', '--verify', `${requested}^{commit}`], {
      cwd: repository,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    if (actual !== requested) throw new Error('Revision is not the requested commit.');
  }
  const ledgerBytes = readBlob(repository, inventoryRevision, ledgerPath);
  if (hash(ledgerBytes) !== ledgerSha256) throw new Error('Recovered inventory identity changed.');
  const ledger = JSON.parse(ledgerBytes);
  const binding = ledger.definitionBinding;
  if (binding.originalRevision !== FOUNDATION_ANCHOR.manifestSha256) {
    throw new Error('Original manifest identity changed.');
  }
  const ids = new Set();
  const definitions = binding.definitions.map((prior) => {
    if (
      !/^spec\/(?:adapters|contracts|decisions|host-caps|modules|tests)\/[A-Z0-9-]+\.yaml$/.test(
        prior.governingSource
      ) ||
      ids.has(prior.id)
    )
      throw new Error('Invalid or duplicate recovered definition.');
    ids.add(prior.id);
    const bytes = readBlob(repository, revision, prior.governingSource);
    const entity = parse(bytes.toString('utf8'));
    if (entity.id !== prior.id) throw new Error('Canonical definition identity changed.');
    const sha256 = hash(bytes);
    return {
      id: prior.id,
      governingSource: prior.governingSource,
      originalLifecycle: prior.originalLifecycle,
      originalSha256: prior.sameBytesAtPublicBase ? prior.currentSha256 : null,
      originalHashBasis: prior.sameBytesAtPublicBase
        ? 'inferred from the anchored public same-bytes record'
        : 'not individually published in the recovery inventory',
      comparisonLifecycle: prior.currentLifecycle,
      currentLifecycle: entity.status,
      since: entity.since,
      activeSince: entity.activeSince ?? null,
      revisions: (entity.revisions ?? []).map(({ version, change }) => ({ version, change })),
      comparisonSha256: prior.currentSha256,
      currentSha256: sha256,
      changedSinceComparison: sha256 !== prior.currentSha256,
      lifecycleChangedSinceComparison: entity.status !== prior.currentLifecycle,
      sourceReferences: prior.sourceReferences,
      boundaryGroups: prior.boundaryGroups,
      openQuestions: (entity.openQuestions ?? []).map(({ id, blocks }) => ({ id, blocks })),
      ownerAcceptance: 'not inferred by source comparison',
    };
  });
  if (definitions.length !== binding.canonicalDefinitions || definitions.length !== 61) {
    throw new Error('Recovered canonical-definition denominator changed.');
  }
  return {
    kind: 'proto-ui.frozen-foundation-definition-comparison',
    format: 1,
    revision,
    sourceLedger: { path: ledgerPath, revision: inventoryRevision, sha256: hash(ledgerBytes) },
    frozenManifestSha256: binding.originalRevision,
    comparisonRevision: binding.currentRevision,
    summary: {
      canonicalDefinitions: definitions.length,
      sourceReferences: binding.sourceReferenceCount,
      unchanged: definitions.filter((row) => !row.changedSinceComparison).length,
      changed: definitions.filter((row) => row.changedSinceComparison).length,
      lifecycleChanges: definitions.filter((row) => row.lifecycleChangedSinceComparison).length,
    },
    definitions,
    boundaryGroups: ledger.boundaryGroups,
    deliveryDependencies: ledger.deliveryDependencies,
    definitionApproval: false,
    sourceExecuted: false,
    originalAuthorRightsCertified: false,
    migrationExecuted: false,
    MERGE_READY: false,
  };
}

async function main(args) {
  if (
    (args.length !== 4 && args.length !== 6) ||
    args[0] !== '--repository' ||
    args[2] !== '--revision' ||
    (args.length === 6 && args[4] !== '--inventory-revision')
  ) {
    process.stderr.write(
      'Usage: node scripts/compiler/inspect-foundation-definitions.mjs --repository PATH --revision FULL_COMMIT_SHA [--inventory-revision FULL_COMMIT_SHA]\n'
    );
    process.exitCode = 2;
    return;
  }
  try {
    process.stdout.write(
      `${JSON.stringify(inspectFoundationDefinitions(args[1], args[3], args[5]), null, 2)}\n`
    );
  } catch {
    // Do not print supplied filesystem paths or raw Git stderr in receipts.
    process.stdout.write(
      `${JSON.stringify({ kind: 'proto-ui.frozen-foundation-definition-comparison', format: 1, passed: false, failure: 'DEFINITION_COMPARISON_FAILED' })}\n`
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main(process.argv.slice(2));
}
