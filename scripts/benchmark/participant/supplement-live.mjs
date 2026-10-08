import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { inspectSupplement } from './supplement-plan.mjs';
import { sha256 } from './nine-plan.mjs';
import { executeSupplement, validateSupplementAuthorization } from './supplement-runner.mjs';
import { responsesTransport } from './http-transport.mjs';
import { observeConfiguredRoute } from './live-route.mjs';
export async function runAuthorizedSupplement({
  directory,
  manifestSha256,
  authorizationPath,
  executionDirectory,
  evidenceDirectory,
}) {
  const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const { manifest } = await inspectSupplement({ directory, manifestSha256, sourceRoot });
  const authorization = JSON.parse(await readFile(authorizationPath, 'utf8'));
  validateSupplementAuthorization({
    authorization,
    manifestSha256,
    manifest,
    mode: 'live-participant',
  });
  const reviewBytes = await readFile(authorization.reviewReference);
  assert.equal(sha256(reviewBytes), authorization.reviewSha256);
  const review = JSON.parse(reviewBytes);
  assert.equal(review.verdict, 'APPROVE');
  assert.equal(review.manifestSha256, manifestSha256);
  const rehearsalBytes = await readFile(review.rehearsalReference);
  assert.equal(
    sha256(rehearsalBytes),
    review.rehearsalSha256,
    'Offline E2E review binding changed'
  );
  const rehearsal = JSON.parse(rehearsalBytes);
  assert.equal(rehearsal.passed, true);
  assert.equal(rehearsal.synthetic, true);
  assert.equal(rehearsal.participantProviderCalls, 0);
  assert.equal(rehearsal.manifestSha256, manifestSha256);
  assert.equal(manifest.budgetPolicy.referenceEnvelopeStopEnabled, false);
  const route = await observeConfiguredRoute();
  assert.equal(route.routeFingerprint, manifest.executionConfig.routeFingerprint);
  const save = (n, v) =>
    writeFile(path.join(evidenceDirectory, n), JSON.stringify(v, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
  await save('live-start.json', {
    started: new Date().toISOString(),
    manifestSha256,
    route,
    maxClientDispatches: 6,
    clientRetries: 0,
    feeBasedStopsDisabled: true,
    quotaExhaustionAccepted: true,
    originalRecordsPreserved: true,
    credentialPolicy:
      'Existing local auth only in trusted process and HTTP Authorization; no credential serialization',
  });
  let secret = JSON.parse(
    await readFile(path.join(os.homedir(), '.codex/auth.json'), 'utf8')
  ).OPENAI_API_KEY;
  assert.ok(
    typeof secret === 'string' && secret.length > 0,
    'Configured authentication unavailable'
  );
  let routeChecks = 0;
  try {
    const ledger = await executeSupplement({
      directory,
      manifestSha256,
      sourceRoot,
      executionDirectory,
      mode: 'live-participant',
      authorization,
      observeRoute: async () => {
        const r = await observeConfiguredRoute();
        await save(`route-before-${++routeChecks}.json`, r);
        return r;
      },
      transportFactory: ({ archiveDir, executionConfig }) =>
        responsesTransport({
          endpoint: executionConfig.endpoint,
          token: secret,
          archiveDir,
          allowLoopbackHttp: executionConfig.allowLoopbackHttp,
          requestTimeoutMs: executionConfig.requestTimeoutMs,
          maxResponseBytes: executionConfig.maxResponseBytes,
        }),
    });
    const files = await readdir(executionDirectory, { recursive: true, withFileTypes: true });
    let inspectedFiles = 0;
    for (const file of files.filter((f) => f.isFile())) {
      const b = await readFile(path.join(file.parentPath, file.name));
      assert.equal(b.includes(Buffer.from(secret)), false, 'Credential unexpectedly archived');
      inspectedFiles++;
    }
    await save('live-finish.json', {
      finished: new Date().toISOString(),
      manifestSha256,
      dispatches: ledger.dispatches,
      coverage: ledger.coverage,
      stopReason: ledger.stopReason,
      retries: ledger.retries,
      referenceKnownUSD: ledger.referenceKnownUSD,
      actualUSD: ledger.actualUSD,
      credentialEvidenceScan: {
        inspectedFiles,
        secretAbsent: true,
        scope:
          'trusted caller actual credential-value scan; independent reviewer does not read secret',
      },
    });
    return ledger;
  } finally {
    secret = null;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [directory, manifestSha256, authorizationPath, executionDirectory, evidenceDirectory] =
    process.argv.slice(2);
  assert.ok(
    directory && manifestSha256 && authorizationPath && executionDirectory && evidenceDirectory,
    'Five explicit supplement-freeze/grant/output arguments required'
  );
  const ledger = await runAuthorizedSupplement({
    directory,
    manifestSha256,
    authorizationPath,
    executionDirectory,
    evidenceDirectory,
  });
  console.log(
    JSON.stringify({
      dispatches: ledger.dispatches,
      coverage: ledger.coverage,
      stopReason: ledger.stopReason,
      referenceKnownUSD: ledger.referenceKnownUSD,
      actualUSD: ledger.actualUSD,
    })
  );
}
