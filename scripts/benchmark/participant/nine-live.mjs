import assert from 'node:assert/strict';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { executeNine, validateNineAuthorization } from './nine-runner.mjs';
import { inspectNineRevision, sha256 } from './nine-plan.mjs';
import { observeConfiguredRoute } from './live-route.mjs';
import { responsesTransport } from './http-transport.mjs';

// Only direct invocation dispatches. Importing this source never reads a secret
// or starts inference. Frozen packets are the sole participant-facing context.
export async function runAuthorizedNine({
  directory,
  manifestSha256,
  authorizationPath,
  executionDirectory,
  evidenceDirectory,
}) {
  const sourceRoot = fileURLToPath(new URL('../../../', import.meta.url));
  const { manifest } = await inspectNineRevision({ directory, manifestSha256, sourceRoot });
  const authorization = JSON.parse(await readFile(authorizationPath, 'utf8'));
  validateNineAuthorization({ authorization, manifestSha256, manifest, mode: 'live-participant' });
  assert.equal(manifest.budgetPolicy.referenceEnvelopeStopEnabled, false);
  const decisionBytes = await readFile(authorization.userDecisionReference);
  assert.equal(
    sha256(decisionBytes),
    manifest.budgetPolicy.userDecisionSha256,
    'User decision binding changed'
  );
  const decision = JSON.parse(decisionBytes);
  assert.equal(decision.interpretation.feeStopsDisabled, true);
  assert.equal(decision.interpretation.provider, 'yvxi');
  assert.equal(decision.interpretation.maxClientDispatches, 9);
  const initialRoute = await observeConfiguredRoute();
  assert.equal(initialRoute.routeFingerprint, manifest.executionConfig.routeFingerprint);
  await writeFile(
    path.join(evidenceDirectory, 'live-start.json'),
    JSON.stringify(
      {
        started: new Date().toISOString(),
        manifestSha256,
        route: initialRoute,
        maxClientDispatches: 9,
        clientRetries: 0,
        feeBasedStopsDisabled: true,
        quotaExhaustionAccepted: true,
        credentialPolicy:
          'Existing local auth used only in Authorization header; never serialized into grant/config/request/archive',
        providerInternalBehavior: 'unknown; not claimed to be fully authenticated',
      },
      null,
      2
    ) + '\n',
    { flag: 'wx', mode: 0o600 }
  );
  let secret = JSON.parse(
    await readFile(path.join(os.homedir(), '.codex/auth.json'), 'utf8')
  ).OPENAI_API_KEY;
  assert.ok(
    typeof secret === 'string' && secret.length > 0,
    'Configured authentication unavailable'
  );
  let routeChecks = 0;
  try {
    const ledger = await executeNine({
      directory,
      manifestSha256,
      sourceRoot,
      executionDirectory,
      mode: 'live-participant',
      authorization,
      observeRoute: async () => {
        const observation = await observeConfiguredRoute();
        await writeFile(
          path.join(evidenceDirectory, `route-before-${++routeChecks}.json`),
          JSON.stringify(observation, null, 2) + '\n',
          { flag: 'wx', mode: 0o600 }
        );
        return observation;
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
    for (const entry of files.filter((e) => e.isFile())) {
      const raw = await readFile(path.join(entry.parentPath, entry.name));
      assert.equal(
        raw.includes(Buffer.from(secret)),
        false,
        'Authentication unexpectedly present in archived evidence'
      );
      inspectedFiles++;
    }
    await writeFile(
      path.join(evidenceDirectory, 'live-finish.json'),
      JSON.stringify(
        {
          finished: new Date().toISOString(),
          manifestSha256,
          dispatches: ledger.dispatches,
          coverage: ledger.coverage,
          stopReason: ledger.stopReason,
          retries: ledger.retries,
          referenceKnownUSD: ledger.referenceKnownUSD,
          referenceIsMeasurementOnly: true,
          actualUSD: ledger.actualUSD,
          credentialEvidenceScan: { inspectedFiles, secretAbsent: true },
        },
        null,
        2
      ) + '\n',
      { flag: 'wx', mode: 0o600 }
    );
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
    'Five explicit frozen-plan/grant/output arguments required'
  );
  const ledger = await runAuthorizedNine({
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
