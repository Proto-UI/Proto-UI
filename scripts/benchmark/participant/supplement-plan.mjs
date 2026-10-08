import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import path from 'node:path';
import { inspectNineRevision, sha256, jsonBytes } from './nine-plan.mjs';

export const parentManifestDigest =
  '19c22b29dd5df723efa8f268f7fbf175524b168294e9d201393c0b8696691639';
export const parentLedgerDigest =
  '8ca8d0609f6b8a37cf490b7815a01d29cfb8b34d05ef9b576c33c74b3e06d596';
export const supplementSources = [
  'scripts/benchmark/participant/supplement-plan.mjs',
  'scripts/benchmark/participant/supplement-runner.mjs',
  'scripts/benchmark/participant/supplement-live.mjs',
  'scripts/benchmark/participant/supplement-rehearsal.mjs',
  'scripts/benchmark/participant/supplement.test.mjs',
];
const save = (dir, name, value) =>
  writeFile(path.join(dir, name), jsonBytes(value), { flag: 'wx', mode: 0o600 });
async function regularFile(file) {
  assert.ok(path.isAbsolute(file), 'Absolute evidence/source path required');
  let current = path.parse(file).root;
  const parts = file.slice(current.length).split('/');
  for (const [index, part] of parts.entries()) {
    assert.ok(part && part !== '.' && part !== '..', 'Unsafe evidence/source path');
    current = path.join(current, part);
    const s = await lstat(current);
    assert.equal(s.isSymbolicLink(), false, 'Symlink evidence/source rejected');
    assert.ok(index === parts.length - 1 ? s.isFile() : s.isDirectory());
  }
  return readFile(file);
}
async function derive({
  parentDirectory,
  parentManifestSha256,
  parentLedgerPath,
  userAuthorizationPath,
  diagnosticPath,
  sourceRoot,
}) {
  assert.equal(parentManifestSha256, parentManifestDigest, 'Original parent freeze required');
  const { manifest: parent, packets } = await inspectNineRevision({
    directory: parentDirectory,
    manifestSha256: parentManifestSha256,
    sourceRoot,
  });
  const ledgerBytes = await regularFile(parentLedgerPath);
  assert.equal(sha256(ledgerBytes), parentLedgerDigest, 'Original ledger changed');
  const ledger = JSON.parse(ledgerBytes);
  assert.equal(ledger.dispatches, 4);
  assert.equal(ledger.rows[3].scoringEligible, false);
  assert.equal(ledger.rows[3].dispatched, true);
  const baseline = ledger.rows[0].reportedSettings;
  for (const row of ledger.rows.slice(0, 3)) assert.deepEqual(row.reportedSettings, baseline);
  const authBytes = await regularFile(userAuthorizationPath),
    decision = JSON.parse(authBytes);
  assert.equal(decision.trustedSource, 'current-user');
  const scope = decision.authorizedScope;
  assert.equal(scope.diagnosticDispatches, 1);
  assert.equal(scope.participantDispatches, 6);
  assert.equal(scope.conditionalOnDiagnosticAndOfflineAdmission, true);
  assert.equal(scope.route, 'yvxi');
  assert.equal(scope.model, 'gpt-6.1-sol');
  assert.deepEqual(scope.originalSlotOrdinals, [4, 5, 6, 7, 8, 9]);
  assert.deepEqual(scope.conditions, ['proto', 'ordinary', 'none', 'none', 'proto', 'ordinary']);
  for (const key of ['clientRetries', 'replacements', 'discovery']) assert.equal(scope[key], 0);
  assert.equal(scope.feeLimitUSD, null);
  assert.equal(scope.noNewCreditPurchase, true);
  assert.equal(scope.originalFailedAttemptPreserved, true);
  assert.equal(scope.originalNonfeeStopsInherited, true);
  const diagBytes = await regularFile(diagnosticPath),
    diagnostic = JSON.parse(diagBytes);
  assert.equal(diagnostic.passed, true);
  assert.equal(diagnostic.dispatches, 1);
  assert.equal(diagnostic.participantSample, false);
  assert.equal(diagnostic.clientRetries, 0);
  for (const [key, value] of Object.entries(baseline))
    if (value != null && diagnostic.reportedSettings[key] != null)
      assert.deepEqual(
        diagnostic.reportedSettings[key],
        value,
        'Diagnostic reported settings changed'
      );
  assert.equal(diagnostic.reportedSettings.model, 'gpt-6.1-sol');
  const schedule = parent.schedule.slice(3).map((slot, index) => ({
    ...slot,
    id: `supplement-1-attempt-${index + 1}`,
    originalSlotId: slot.id,
    originalSlotOrdinal: index + 4,
    newAttemptOrdinal: index + 1,
  }));
  const manifest = {
    schemaVersion: 1,
    kind: 'six-attempt-supplement-freeze',
    revision: 'supplement-v1',
    parent: {
      directory: parentDirectory,
      manifestSha256: parentManifestSha256,
      ledgerPath: parentLedgerPath,
      ledgerSha256: parentLedgerDigest,
    },
    authorization: { path: userAuthorizationPath, sha256: sha256(authBytes) },
    diagnostic: { path: diagnosticPath, sha256: sha256(diagBytes), participantSample: false },
    schedule,
    seed: parent.randomization.seed,
    model: parent.model,
    wire: parent.wire,
    coreInventory: parent.coreInventory,
    newFeatureCriteria: parent.newFeatureCriteria,
    regressionCriteria: parent.regressionCriteria,
    budgets: { ...parent.budgets, participantDispatches: 6, reservations: 6 },
    executionConfig: {
      ...parent.executionConfig,
      amendmentVersion: 'supplement-v1-six-suffix',
      amendmentReason:
        'New six attempts after authentication interruption; same route/task/materials/nonfee policies',
    },
    budgetPolicy: {
      ...parent.budgetPolicy,
      maxParticipantDispatches: 6,
      userDecisionReference: userAuthorizationPath,
      userDecisionSha256: sha256(authBytes),
      referenceEnvelopeStopEnabled: false,
    },
    settingsBaseline: baseline,
    packets: parent.packets,
    reporting: {
      originalFailedAttemptRetained: true,
      originalBatchNeverOverwritten: true,
      combinedIsInterruptedExploratory: true,
      diagnosticNotParticipant: true,
    },
  };
  return { manifest, packets };
}
export async function freezeSupplement(options) {
  const { directory, sourceRoot } = options;
  assert.ok(path.isAbsolute(directory));
  const { manifest } = await derive(options);
  await mkdir(directory);
  const inventory = [];
  for (const source of supplementSources) {
    const bytes = await regularFile(path.join(sourceRoot, source));
    const name = path.basename(source);
    await writeFile(path.join(directory, name), bytes, { flag: 'wx', mode: 0o600 });
    inventory.push({ source, path: name, bytes: bytes.length, sha256: sha256(bytes) });
  }
  manifest.supplementSources = inventory;
  await save(directory, 'manifest.json', manifest);
  const manifestSha256 = sha256(jsonBytes(manifest));
  await inspectSupplement({ directory, manifestSha256, sourceRoot });
  return { manifest, manifestSha256 };
}
export async function inspectSupplement({ directory, manifestSha256, sourceRoot }) {
  const raw = await regularFile(path.join(directory, 'manifest.json'));
  assert.equal(sha256(raw), manifestSha256, 'Supplement manifest changed');
  const manifest = JSON.parse(raw);
  const derived = await derive({
    parentDirectory: manifest.parent.directory,
    parentManifestSha256: manifest.parent.manifestSha256,
    parentLedgerPath: manifest.parent.ledgerPath,
    userAuthorizationPath: manifest.authorization.path,
    diagnosticPath: manifest.diagnostic.path,
    sourceRoot,
  });
  const { supplementSources: inventory, ...content } = manifest;
  assert.deepEqual(
    content,
    derived.manifest,
    'Supplement changes beyond authorized suffix/execution metadata'
  );
  assert.deepEqual(
    inventory.map((i) => i.source),
    supplementSources,
    'Required supplemental source inventory'
  );
  for (const entry of inventory) {
    assert.equal(entry.path, path.basename(entry.source));
    for (const file of [path.join(directory, entry.path), path.join(sourceRoot, entry.source)]) {
      const bytes = await regularFile(file);
      assert.equal(bytes.length, entry.bytes, 'Supplement source size drift');
      assert.equal(sha256(bytes), entry.sha256, 'Supplement source digest drift');
    }
  }
  return { manifest, packets: derived.packets };
}
